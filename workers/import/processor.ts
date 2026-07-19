/**
 * ImportProgress — Durable Object that owns one import job end-to-end.
 *
 * Processing runs in alarm-driven chunks (a state machine persisted in DO
 * storage), so arbitrarily large files never hit a request timeout. Each
 * tick processes a bounded slice of work, persists its cursor, re-arms the
 * alarm, and pushes progress to any connected SSE clients.
 *
 * Stages: rows (animals -> contacts -> medical -> adoptions, so links can
 * resolve) -> bond (bonded-pair groups) -> photos (re-host to R2) -> done.
 */

import { DurableObject } from "cloudflare:workers";
import { readRows } from "../lib/filesource";
import { normalizeRow } from "../lib/rows";
import type { FileKind } from "../lib/normalize";
import { newId } from "../lib/ids";

const ROWS_PER_TICK = 1000;
const PHOTOS_PER_TICK = 12;
const PHOTO_TIMEOUT_MS = 10_000;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_ANIMAL = 6;

const KIND_ORDER: Record<string, number> = { animals: 0, contacts: 1, medical: 2, adoptions: 3 };

interface JobFile {
  id: string;
  kind: FileKind;
  r2_key: string;
  format: string;
  original_name: string;
  mapping: Record<string, string | null>;
}

interface JobState {
  jobId: string;
  files: JobFile[];
  stage: "rows" | "bond" | "photos" | "done" | "failed";
  fileIdx: number;
  rowSkip: number;
  photoSkip: number;
  counters: {
    rowsTotal: number;
    rowsOk: number;
    rowsFlagged: number;
    photosOk: number;
    photosFailed: number;
  };
  currentFileName?: string;
  error?: string;
}

export class ImportProgress extends DurableObject<Env> {
  private clients = new Set<ReadableStreamDefaultController>();
  // in-memory link indexes, rebuilt lazily after eviction
  private animalIndex: Map<string, string> | null = null;
  private contactIndex: Map<string, string> | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/start") {
      const { jobId, files } = (await request.json()) as { jobId: string; files: JobFile[] };
      const sorted = [...files].sort(
        (a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9),
      );
      const state: JobState = {
        jobId,
        files: sorted,
        stage: "rows",
        fileIdx: 0,
        rowSkip: 0,
        photoSkip: 0,
        counters: { rowsTotal: 0, rowsOk: 0, rowsFlagged: 0, photosOk: 0, photosFailed: 0 },
      };
      await this.ctx.storage.put("state", state);
      await this.ctx.storage.setAlarm(Date.now() + 50);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/status") {
      const state = await this.ctx.storage.get<JobState>("state");
      return Response.json(this.progressPayload(state));
    }

    if (url.pathname === "/events") {
      const state = await this.ctx.storage.get<JobState>("state");
      const encoder = new TextEncoder();
      const clients = this.clients;
      let ctrl: ReadableStreamDefaultController;
      const stream = new ReadableStream({
        start: (controller) => {
          ctrl = controller;
          clients.add(controller);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(this.progressPayload(state))}\n\n`),
          );
        },
        cancel: () => {
          clients.delete(ctrl);
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return new Response("not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    const state = await this.ctx.storage.get<JobState>("state");
    if (!state || state.stage === "done" || state.stage === "failed") return;

    try {
      if (state.stage === "rows") await this.tickRows(state);
      else if (state.stage === "bond") await this.tickBond(state);
      else if (state.stage === "photos") await this.tickPhotos(state);

      await this.ctx.storage.put("state", state);
      await this.syncJobRow(state);
      this.broadcast(state);

      const stage = state.stage as JobState["stage"];
      if (stage !== "done" && stage !== "failed") {
        await this.ctx.storage.setAlarm(Date.now() + 50);
      }
    } catch (err) {
      state.stage = "failed";
      state.error = err instanceof Error ? err.message : String(err);
      await this.ctx.storage.put("state", state);
      await this.syncJobRow(state);
      this.broadcast(state);
    }
  }

  // ---------- stage: rows ----------

  private async tickRows(state: JobState): Promise<void> {
    const file = state.files[state.fileIdx];
    if (!file) {
      state.stage = "bond";
      return;
    }
    state.currentFileName = file.original_name;
    const db = this.env.DB;
    const stmts: D1PreparedStatement[] = [];

    let headers: string[] = [];
    const rowsBuffer: { row: string[]; rowNum: number }[] = [];
    const result = await readRows(
      this.env.MEDIA,
      file.r2_key,
      file.format,
      (row, rowNum) => {
        rowsBuffer.push({ row, rowNum });
      },
      { skip: state.rowSkip, limit: ROWS_PER_TICK },
    );
    headers = result.headers;

    for (const { row, rowNum } of rowsBuffer) {
      const { record, issues, ok } = normalizeRow(file.kind, headers, row, file.mapping);
      state.counters.rowsTotal++;

      for (const issue of issues) {
        stmts.push(
          db
            .prepare(
              `INSERT INTO import_row_errors (job_id, file_id, row_num, field, reason, raw_json)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              state.jobId,
              file.id,
              rowNum,
              issue.field,
              issue.reason,
              JSON.stringify(Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]))),
            ),
        );
      }

      if (!ok) {
        state.counters.rowsFlagged++;
        continue;
      }
      if (issues.length) state.counters.rowsFlagged++;
      else state.counters.rowsOk++;

      stmts.push(...(await this.stageRowStatements(state, file, record, rowNum, issues.length > 0)));
    }

    // batch in slices to stay under D1 limits
    for (let i = 0; i < stmts.length; i += 50) {
      await db.batch(stmts.slice(i, i + 50));
    }

    if (result.done) {
      state.fileIdx++;
      state.rowSkip = 0;
    } else {
      state.rowSkip += result.emitted;
    }
  }

  private async stageRowStatements(
    state: JobState,
    file: JobFile,
    r: Record<string, unknown>,
    rowNum: number,
    hadIssues: boolean,
  ): Promise<D1PreparedStatement[]> {
    const db = this.env.DB;
    const jobId = state.jobId;

    if (file.kind === "animals") {
      const id = newId("sa");
      if (this.animalIndex) {
        // keep the in-memory index warm as we insert
        if (r.source_key) this.animalIndex.set(`k:${String(r.source_key).toLowerCase()}`, id);
        if (r.name) this.animalIndex.set(`n:${String(r.name).toLowerCase()}`, id);
        if (r.microchip) this.animalIndex.set(`c:${String(r.microchip).toLowerCase()}`, id);
      }
      return [
        db
          .prepare(
            `INSERT INTO staging_animals
             (id, job_id, row_num, source_key, name, species, breed, sex, dob, altered,
              microchip, status, description, bonded_with, intake_date, photo_urls)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id, jobId, rowNum,
            (r.source_key as string) ?? null,
            r.name as string,
            (r.species as string) ?? null,
            (r.breed as string) ?? null,
            (r.sex as string) ?? null,
            (r.dob as string) ?? null,
            (r.altered as number | undefined) ?? null,
            (r.microchip as string) ?? null,
            (r.status as string) ?? "available",
            (r.description as string) ?? null,
            (r.bonded_with as string) ?? null,
            (r.intake_date as string) ?? null,
            r.photo_urls ? JSON.stringify(r.photo_urls) : null,
          ),
      ];
    }

    if (file.kind === "contacts") {
      const id = newId("sc");
      if (this.contactIndex) {
        if (r.source_key) this.contactIndex.set(`k:${String(r.source_key).toLowerCase()}`, id);
        if (r.name) this.contactIndex.set(`n:${String(r.name).toLowerCase()}`, id);
      }
      return [
        db
          .prepare(
            `INSERT INTO staging_contacts
             (id, job_id, row_num, source_key, name, email, phone, address, roles)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id, jobId, rowNum,
            (r.source_key as string) ?? null,
            r.name as string,
            (r.email as string) ?? null,
            (r.phone as string) ?? null,
            (r.address as string) ?? null,
            (r.roles as string) ?? null,
          ),
      ];
    }

    if (file.kind === "medical") {
      const animalId = await this.resolveAnimal(state.jobId, String(r.animal_ref ?? ""));
      const stmts: D1PreparedStatement[] = [
        db
          .prepare(
            `INSERT INTO staging_medical
             (id, job_id, row_num, source_key, animal_ref, staging_animal_id, date, type, description, vet)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            newId("sm"), state.jobId, rowNum,
            (r.source_key as string) ?? null,
            (r.animal_ref as string) ?? null,
            animalId,
            (r.date as string) ?? null,
            (r.type as string) ?? null,
            (r.description as string) ?? null,
            (r.vet as string) ?? null,
          ),
      ];
      if (!animalId) {
        if (!hadIssues) {
          state.counters.rowsFlagged++;
          state.counters.rowsOk--;
        }
        stmts.push(
          db
            .prepare(
              `INSERT INTO import_row_errors (job_id, file_id, row_num, field, reason, raw_json)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              state.jobId, file.id, rowNum, "animal_ref",
              `could not match animal "${r.animal_ref}" — record kept but unattached`,
              null,
            ),
        );
      }
      return stmts;
    }

    // adoptions
    const animalId = await this.resolveAnimal(state.jobId, String(r.animal_ref ?? ""));
    const contactId = await this.resolveContact(state.jobId, String(r.contact_ref ?? ""));
    const stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO staging_adoptions
           (id, job_id, row_num, source_key, animal_ref, staging_animal_id,
            contact_ref, staging_contact_id, date, fee, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId("sd"), state.jobId, rowNum,
          (r.source_key as string) ?? null,
          (r.animal_ref as string) ?? null,
          animalId,
          (r.contact_ref as string) ?? null,
          contactId,
          (r.date as string) ?? null,
          (r.fee as number | undefined) ?? null,
          (r.status as string) ?? "completed",
        ),
    ];
    if (!animalId) {
      if (!hadIssues) {
        state.counters.rowsFlagged++;
        state.counters.rowsOk--;
      }
      stmts.push(
        db
          .prepare(
            `INSERT INTO import_row_errors (job_id, file_id, row_num, field, reason, raw_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            state.jobId, file.id, rowNum, "animal_ref",
            `could not match animal "${r.animal_ref}" — adoption kept but unlinked`,
            null,
          ),
      );
    }
    return stmts;
  }

  // ---------- link resolution ----------

  private async ensureAnimalIndex(jobId: string): Promise<Map<string, string>> {
    if (this.animalIndex) return this.animalIndex;
    const idx = new Map<string, string>();
    const rows = await this.env.DB.prepare(
      `SELECT id, source_key, name, microchip FROM staging_animals WHERE job_id = ?`,
    )
      .bind(jobId)
      .all<{ id: string; source_key: string | null; name: string; microchip: string | null }>();
    for (const a of rows.results) {
      if (a.source_key) idx.set(`k:${a.source_key.toLowerCase()}`, a.id);
      if (a.name) idx.set(`n:${a.name.toLowerCase()}`, a.id);
      if (a.microchip) idx.set(`c:${a.microchip.toLowerCase()}`, a.id);
    }
    this.animalIndex = idx;
    return idx;
  }

  private async ensureContactIndex(jobId: string): Promise<Map<string, string>> {
    if (this.contactIndex) return this.contactIndex;
    const idx = new Map<string, string>();
    const rows = await this.env.DB.prepare(
      `SELECT id, source_key, name FROM staging_contacts WHERE job_id = ?`,
    )
      .bind(jobId)
      .all<{ id: string; source_key: string | null; name: string }>();
    for (const c of rows.results) {
      if (c.source_key) idx.set(`k:${c.source_key.toLowerCase()}`, c.id);
      if (c.name) idx.set(`n:${c.name.toLowerCase()}`, c.id);
    }
    this.contactIndex = idx;
    return idx;
  }

  private async resolveAnimal(jobId: string, ref: string): Promise<string | null> {
    const r = ref.trim().toLowerCase();
    if (!r) return null;
    const idx = await this.ensureAnimalIndex(jobId);
    return idx.get(`k:${r}`) ?? idx.get(`c:${r}`) ?? idx.get(`n:${r}`) ?? null;
  }

  private async resolveContact(jobId: string, ref: string): Promise<string | null> {
    const r = ref.trim().toLowerCase();
    if (!r) return null;
    const idx = await this.ensureContactIndex(jobId);
    return idx.get(`k:${r}`) ?? idx.get(`n:${r}`) ?? null;
  }

  // ---------- stage: bonded pairs ----------

  private async tickBond(state: JobState): Promise<void> {
    const db = this.env.DB;
    const idx = await this.ensureAnimalIndex(state.jobId);
    const bonded = await db
      .prepare(
        `SELECT id, bonded_with FROM staging_animals
         WHERE job_id = ? AND bonded_with IS NOT NULL AND bonded_with != ''`,
      )
      .bind(state.jobId)
      .all<{ id: string; bonded_with: string }>();

    // union-find over (animal -> referenced companion)
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      let root = x;
      while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
      return root;
    };
    const union = (a: string, b: string) => {
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    for (const row of bonded.results) {
      const ref = row.bonded_with.trim().toLowerCase();
      const other = idx.get(`k:${ref}`) ?? idx.get(`n:${ref}`) ?? idx.get(`c:${ref}`);
      if (other && other !== row.id) union(row.id, other);
    }

    const groups = new Map<string, string[]>();
    for (const key of parent.keys()) {
      const root = find(key);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(key);
    }

    const stmts: D1PreparedStatement[] = [];
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      const groupId = newId("bg");
      for (const m of members) {
        stmts.push(
          db.prepare(`UPDATE staging_animals SET bonded_group_id = ? WHERE id = ?`).bind(groupId, m),
        );
      }
    }
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));

    state.stage = "photos";
  }

  // ---------- stage: photos ----------

  private async tickPhotos(state: JobState): Promise<void> {
    const db = this.env.DB;
    const animals = await db
      .prepare(
        `SELECT id, photo_urls FROM staging_animals
         WHERE job_id = ? AND photo_urls IS NOT NULL
         ORDER BY rowid LIMIT ? OFFSET ?`,
      )
      .bind(state.jobId, PHOTOS_PER_TICK, state.photoSkip)
      .all<{ id: string; photo_urls: string }>();

    if (!animals.results.length) {
      state.stage = "done";
      state.currentFileName = undefined;
      return;
    }

    for (const animal of animals.results) {
      let urls: string[] = [];
      try {
        urls = (JSON.parse(animal.photo_urls) as string[]).slice(0, MAX_PHOTOS_PER_ANIMAL);
      } catch {
        urls = [];
      }
      let n = 0;
      for (const url of urls) {
        try {
          const res = await fetch(url, {
            signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS),
            headers: { "User-Agent": "ViaTutela-Importer/1.0" },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const type = res.headers.get("content-type") ?? "";
          if (!type.startsWith("image/")) throw new Error(`not an image (${type || "unknown type"})`);
          const buf = await res.arrayBuffer();
          if (buf.byteLength > PHOTO_MAX_BYTES) throw new Error("image larger than 10MB");
          const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "jpg";
          const key = `staging/${state.jobId}/photos/${animal.id}-${n}.${ext}`;
          await this.env.MEDIA.put(key, buf, { httpMetadata: { contentType: type } });
          await db
            .prepare(
              `INSERT INTO staging_photos (id, job_id, staging_animal_id, r2_key, source_url)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(newId("sp"), state.jobId, animal.id, key, url)
            .run();
          state.counters.photosOk++;
          n++;
        } catch (err) {
          state.counters.photosFailed++;
          await db
            .prepare(
              `INSERT INTO import_row_errors (job_id, file_id, row_num, field, reason, raw_json)
               VALUES (?, ?, 0, 'photo', ?, ?)`,
            )
            .bind(
              state.jobId,
              state.files[0]?.id ?? "",
              `photo could not be fetched: ${err instanceof Error ? err.message : "error"}`,
              JSON.stringify({ url, animal: animal.id }),
            )
            .run();
        }
      }
    }
    state.photoSkip += animals.results.length;
  }

  // ---------- progress plumbing ----------

  private async syncJobRow(state: JobState): Promise<void> {
    const status =
      state.stage === "done" ? "done" : state.stage === "failed" ? "failed" : "processing";
    await this.env.DB.prepare(
      `UPDATE import_jobs
       SET status = ?, rows_total = ?, rows_ok = ?, rows_flagged = ?,
           photos_ok = ?, photos_failed = ?, error = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(
        status,
        state.counters.rowsTotal,
        state.counters.rowsOk,
        state.counters.rowsFlagged,
        state.counters.photosOk,
        state.counters.photosFailed,
        state.error ?? null,
        state.jobId,
      )
      .run();
  }

  private progressPayload(state: JobState | undefined | null) {
    if (!state) return { status: "unknown", stage: "unknown" };
    return {
      status: state.stage === "done" ? "done" : state.stage === "failed" ? "failed" : "processing",
      stage: state.stage,
      currentFile: state.currentFileName ?? null,
      fileIdx: state.fileIdx,
      fileCount: state.files.length,
      ...state.counters,
      error: state.error ?? null,
    };
  }

  private broadcast(state: JobState): void {
    const payload = `data: ${JSON.stringify(this.progressPayload(state))}\n\n`;
    const bytes = new TextEncoder().encode(payload);
    for (const client of this.clients) {
      try {
        client.enqueue(bytes);
        if (state.stage === "done" || state.stage === "failed") client.close();
      } catch {
        this.clients.delete(client);
      }
    }
    if (state.stage === "done" || state.stage === "failed") this.clients.clear();
  }
}
