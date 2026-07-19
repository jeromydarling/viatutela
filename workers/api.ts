/**
 * Tutela API — Hono app mounted at /api/* inside the Worker.
 */

import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { newId, newToken } from "./lib/ids";
import { readHeaders, readRows } from "./lib/filesource";
import {
  CANONICAL_FIELDS,
  guessFileKind,
  suggestMapping,
  type FileKind,
} from "./lib/normalize";
import { normalizeRow } from "./lib/rows";
import { toCsv } from "./lib/csv";
import { promoteImport } from "./import/promote";
import { AUTH_COOKIE, getAuthedUser } from "./lib/auth";
import { hashPassword } from "./lib/password";
import { sendAppEmail } from "./lib/email";

type AppEnv = { Bindings: Env };

const IMPORT_COOKIE = "vt_import_session";
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const VALID_KINDS: FileKind[] = ["animals", "contacts", "medical", "adoptions"];

export const api = new Hono<AppEnv>().basePath("/api");

api.get("/health", (c) => c.json({ ok: true, service: "viatutela", ts: Date.now() }));

// ---------- anonymous import session ----------

function getOrSetImportSession(c: any): string {
  let token = getCookie(c, IMPORT_COOKIE);
  if (!token || !/^[a-f0-9]{48}$/.test(token)) {
    token = newToken();
    setCookie(c, IMPORT_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
  }
  return token;
}

async function requireJob(c: any, jobId: string) {
  const token = getCookie(c, IMPORT_COOKIE);
  if (!token) return null;
  const job = (await c.env.DB.prepare(
    `SELECT * FROM import_jobs WHERE id = ? AND session_token = ?`,
  )
    .bind(jobId, token)
    .first()) as Record<string, unknown> | null;
  if (job) delete job.session_token;
  return job;
}

// ---------- upload ----------

api.post("/import/upload", async (c) => {
  const token = getOrSetImportSession(c);
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: "That file is a bit too big for us (30MB max per upload)." }, 413);
  }

  const body = await c.req.parseBody({ all: true });
  const rawFiles = body["files"] ?? body["file"];
  const files = (Array.isArray(rawFiles) ? rawFiles : [rawFiles]).filter(
    (f): f is File => f instanceof File,
  );
  if (!files.length) return c.json({ error: "No files received." }, 400);

  let jobId = (typeof body["job_id"] === "string" && body["job_id"]) || null;
  if (jobId) {
    const existing = await requireJob(c, jobId);
    if (!existing) return c.json({ error: "Unknown import job." }, 404);
  } else {
    jobId = newId("job");
    await c.env.DB.prepare(
      `INSERT INTO import_jobs (id, session_token, status) VALUES (?, ?, 'uploaded')`,
    )
      .bind(jobId, token)
      .run();
  }

  const out = [];
  for (const file of files) {
    const name = file.name || "upload.csv";
    const lower = name.toLowerCase();
    const format = lower.endsWith(".xlsx") || lower.endsWith(".xls") ? "xlsx" : "csv";
    const fileId = newId("file");
    const r2Key = `staging/${jobId}/uploads/${fileId}-${name.replace(/[^\w.\-]/g, "_")}`;

    await c.env.MEDIA.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    let headers: string[] = [];
    let headerError: string | null = null;
    try {
      headers = await readHeaders(c.env.MEDIA, r2Key, format);
    } catch (err) {
      headerError = err instanceof Error ? err.message : "could not read file";
    }
    if (!headers.length && !headerError) headerError = "no header row found";

    const kind = headerError ? "animals" : guessFileKind(headers, name);
    const mapping = headerError ? {} : suggestMapping(headers, kind);

    await c.env.DB.prepare(
      `INSERT INTO import_files (id, job_id, kind, r2_key, original_name, size, format, headers_json, mapping_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        fileId, jobId, kind, r2Key, name, file.size, format,
        JSON.stringify(headers), JSON.stringify(mapping),
        headerError ? "error" : "mapped",
      )
      .run();

    out.push({
      file_id: fileId,
      name,
      size: file.size,
      format,
      kind,
      headers,
      suggested_mapping: mapping,
      canonical_fields: CANONICAL_FIELDS[kind],
      error: headerError,
    });
  }

  return c.json({ job_id: jobId, files: out });
});

// ---------- job state ----------

api.get("/import/:jobId", async (c) => {
  const job = await requireJob(c, c.req.param("jobId"));
  if (!job) return c.json({ error: "Unknown import job." }, 404);
  const files = await c.env.DB.prepare(
    `SELECT id, kind, original_name, size, format, headers_json, mapping_json, status
     FROM import_files WHERE job_id = ? ORDER BY created_at`,
  )
    .bind(job.id)
    .all();
  return c.json({
    job,
    files: files.results.map((f: Record<string, unknown>) => ({
      file_id: f.id,
      kind: f.kind,
      name: f.original_name,
      size: f.size,
      format: f.format,
      headers: JSON.parse((f.headers_json as string) || "[]"),
      mapping: JSON.parse((f.mapping_json as string) || "{}"),
      status: f.status,
      canonical_fields: CANONICAL_FIELDS[(f.kind as FileKind) ?? "animals"],
    })),
  });
});

// ---------- mapping ----------

api.post("/import/:jobId/files/:fileId/mapping", async (c) => {
  const job = await requireJob(c, c.req.param("jobId"));
  if (!job) return c.json({ error: "Unknown import job." }, 404);
  const { mapping, kind } = (await c.req.json()) as {
    mapping: Record<string, string | null>;
    kind?: FileKind;
  };
  if (kind && !VALID_KINDS.includes(kind)) return c.json({ error: "Unknown file kind." }, 400);

  const allowed = kind ? new Set(CANONICAL_FIELDS[kind]) : null;
  const clean: Record<string, string | null> = {};
  for (const [header, field] of Object.entries(mapping ?? {})) {
    clean[header] = field && (!allowed || allowed.has(field)) ? field : null;
  }

  await c.env.DB.prepare(
    `UPDATE import_files SET mapping_json = ?${kind ? ", kind = ?" : ""} WHERE id = ? AND job_id = ?`,
  )
    .bind(...(kind
      ? [JSON.stringify(clean), kind, c.req.param("fileId"), job.id]
      : [JSON.stringify(clean), c.req.param("fileId"), job.id]))
    .run();
  return c.json({ ok: true, mapping: clean });
});

// ---------- preview ----------

api.get("/import/:jobId/files/:fileId/preview", async (c) => {
  const job = await requireJob(c, c.req.param("jobId"));
  if (!job) return c.json({ error: "Unknown import job." }, 404);
  const file = await c.env.DB.prepare(
    `SELECT * FROM import_files WHERE id = ? AND job_id = ?`,
  )
    .bind(c.req.param("fileId"), job.id)
    .first<Record<string, unknown>>();
  if (!file) return c.json({ error: "Unknown file." }, 404);

  const kind = file.kind as FileKind;
  const mapping = JSON.parse((file.mapping_json as string) || "{}");
  const rows: { row: string[]; rowNum: number }[] = [];
  const res = await readRows(
    c.env.MEDIA,
    file.r2_key as string,
    file.format as string,
    (row, rowNum) => {
      rows.push({ row, rowNum });
    },
    { limit: 25 },
  );

  const preview = rows.map(({ row, rowNum }) => {
    const { record, issues, ok } = normalizeRow(kind, res.headers, row, mapping);
    return { row_num: rowNum, record, issues, ok };
  });

  const fields = CANONICAL_FIELDS[kind].filter((f) =>
    preview.some((p) => p.record[f] !== undefined),
  );
  return c.json({ kind, fields, rows: preview });
});

// ---------- process ----------

api.post("/import/:jobId/process", async (c) => {
  const job = await requireJob(c, c.req.param("jobId"));
  if (!job) return c.json({ error: "Unknown import job." }, 404);
  if (job.status === "processing") return c.json({ ok: true, already: true });

  const files = await c.env.DB.prepare(
    `SELECT id, kind, r2_key, format, original_name, mapping_json FROM import_files
     WHERE job_id = ? AND status != 'error' ORDER BY created_at`,
  )
    .bind(job.id)
    .all<Record<string, unknown>>();
  if (!files.results.length) return c.json({ error: "No readable files to process." }, 400);

  // reset any previous partial run (re-process is idempotent)
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM staging_animals WHERE job_id = ?`).bind(job.id),
    c.env.DB.prepare(`DELETE FROM staging_contacts WHERE job_id = ?`).bind(job.id),
    c.env.DB.prepare(`DELETE FROM staging_medical WHERE job_id = ?`).bind(job.id),
    c.env.DB.prepare(`DELETE FROM staging_adoptions WHERE job_id = ?`).bind(job.id),
    c.env.DB.prepare(`DELETE FROM staging_photos WHERE job_id = ?`).bind(job.id),
    c.env.DB.prepare(`DELETE FROM import_row_errors WHERE job_id = ?`).bind(job.id),
    c.env.DB.prepare(
      `UPDATE import_jobs SET status = 'processing', rows_total = 0, rows_ok = 0,
       rows_flagged = 0, photos_ok = 0, photos_failed = 0, error = NULL,
       updated_at = datetime('now') WHERE id = ?`,
    ).bind(job.id),
  ]);

  const stub = c.env.IMPORT_PROGRESS.get(c.env.IMPORT_PROGRESS.idFromName(job.id as string));
  await stub.fetch("https://do/start", {
    method: "POST",
    body: JSON.stringify({
      jobId: job.id,
      files: files.results.map((f) => ({
        id: f.id,
        kind: f.kind,
        r2_key: f.r2_key,
        format: f.format,
        original_name: f.original_name,
        mapping: JSON.parse((f.mapping_json as string) || "{}"),
      })),
    }),
    headers: { "Content-Type": "application/json" },
  });

  return c.json({ ok: true });
});

// ---------- progress (SSE + poll fallback) ----------

api.get("/import/:jobId/progress", async (c) => {
  const job = await requireJob(c, c.req.param("jobId"));
  if (!job) return c.json({ error: "Unknown import job." }, 404);
  const stub = c.env.IMPORT_PROGRESS.get(c.env.IMPORT_PROGRESS.idFromName(job.id as string));
  const wantsSse = (c.req.header("accept") ?? "").includes("text/event-stream");
  const res = await stub.fetch(wantsSse ? "https://do/events" : "https://do/status");
  return new Response(res.body, res);
});

// ---------- report ----------

api.get("/import/:jobId/report", async (c) => {
  const job = await requireJob(c, c.req.param("jobId"));
  if (!job) return c.json({ error: "Unknown import job." }, 404);
  const errors = await c.env.DB.prepare(
    `SELECT e.row_num, e.field, e.reason, f.original_name
     FROM import_row_errors e JOIN import_files f ON f.id = e.file_id
     WHERE e.job_id = ? ORDER BY f.original_name, e.row_num`,
  )
    .bind(job.id)
    .all<Record<string, unknown>>();

  const csv = toCsv([
    ["file", "row", "field", "needs attention"],
    ...errors.results.map((e) => [
      e.original_name as string,
      e.row_num as number,
      (e.field as string) ?? "",
      e.reason as string,
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="via-tutela-import-report.csv"`,
    },
  });
});

// ---------- summary (for the results screen) ----------

api.get("/import/:jobId/summary", async (c) => {
  const job = await requireJob(c, c.req.param("jobId"));
  if (!job) return c.json({ error: "Unknown import job." }, 404);
  const [animals, contacts, medical, adoptions, bonded, photos, samples] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) n FROM staging_animals WHERE job_id = ?`).bind(job.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM staging_contacts WHERE job_id = ?`).bind(job.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM staging_medical WHERE job_id = ? AND staging_animal_id IS NOT NULL`).bind(job.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM staging_adoptions WHERE job_id = ? AND staging_animal_id IS NOT NULL`).bind(job.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(DISTINCT bonded_group_id) n FROM staging_animals WHERE job_id = ? AND bonded_group_id IS NOT NULL`).bind(job.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM staging_photos WHERE job_id = ?`).bind(job.id).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT name, species, breed FROM staging_animals WHERE job_id = ? LIMIT 6`).bind(job.id).all<Record<string, unknown>>(),
  ]);
  return c.json({
    job,
    staged: {
      animals: animals?.n ?? 0,
      contacts: contacts?.n ?? 0,
      medical: medical?.n ?? 0,
      adoptions: adoptions?.n ?? 0,
      bonded_groups: bonded?.n ?? 0,
      photos: photos?.n ?? 0,
    },
    sample_animals: samples.results,
  });
});

// ---------- claim: import -> new org ----------

api.post("/import/:jobId/claim", async (c) => {
  const job = await requireJob(c, c.req.param("jobId"));
  if (!job) return c.json({ error: "Unknown import job." }, 404);
  if (job.status === "claimed") return c.json({ error: "This import already has a home." }, 409);
  if (job.status !== "done") return c.json({ error: "The import isn't finished yet." }, 400);

  const { org_name, email, name, password } = (await c.req.json()) as {
    org_name?: string;
    email?: string;
    name?: string;
    password?: string;
  };
  if (!org_name?.trim() || !email?.trim()) {
    return c.json({ error: "We need an organization name and an email." }, 400);
  }
  if (!password || password.length < 8) {
    return c.json({ error: "Please pick a password of at least 8 characters." }, 400);
  }
  const emailNorm = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNorm)) {
    return c.json({ error: "That email doesn't look quite right." }, 400);
  }
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(emailNorm)
    .first();
  if (existing) return c.json({ error: "That email already has an account." }, 409);

  const pw = await hashPassword(password);
  const orgId = newId("org");
  const slugBase = org_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rescue";
  const slug = `${slugBase}-${orgId.slice(-6)}`;
  const userId = newId("usr");
  const sessionToken = newToken();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO orgs (id, name, slug, plan) VALUES (?, ?, ?, 'free')`).bind(
      orgId, org_name.trim(), slug,
    ),
    c.env.DB.prepare(
      `INSERT INTO users (id, org_id, email, name, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(userId, orgId, emailNorm, name?.trim() || null, pw.hash, pw.salt),
    c.env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).bind(
      sessionToken, userId, expires,
    ),
  ]);

  const promoted = await promoteImport(c.env.DB, job.id as string, orgId);

  const origin = new URL(c.req.url).origin;
  c.executionCtx.waitUntil(
    sendAppEmail(c.env, {
      to: emailNorm,
      subject: "Welcome home — your rescue has a new roof 🏡",
      heading: `Welcome to Tutela, ${org_name.trim()}`,
      paragraphs: [
        `Every one of your ${promoted.animals} friend${promoted.animals === 1 ? "" : "s"} made it across safely — records, relationships, bonded pairs and all.`,
        `Your workspace is ready whenever you are. Move in at your own pace; we'll carry any more boxes you find.`,
      ],
      cta: { label: "Open your workspace", url: `${origin}/app` },
    }),
  );

  setCookie(c, AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });

  return c.json({ ok: true, org: { id: orgId, name: org_name.trim(), slug }, promoted });
});

// ---------- media ----------

api.get("/media/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/media\//, "");
  if (!key || key.includes("..")) return c.text("not found", 404);
  const obj = await c.env.MEDIA.get(key);
  if (!obj) {
    // Demo art materializes lazily: seeding writes only DB rows (subrequest
    // budgets are tight), and the first view copies the bundled asset into
    // R2. Keys look like dm_<artname>[-dm_an_<id>].webp.
    const m = key.match(/^orgs\/org_demo_sunnymeadow\/photos\/dm_(.+?)(?:-dm_an_[a-z0-9_]+)?\.webp$/);
    if (m) {
      const artPath = `/art/${m[1]}.webp`;
      const attempts: (() => Promise<Response>)[] = [
        () => c.env.ASSETS.fetch(new Request(`https://assets.internal${artPath}`)),
        // dev fallback: the vite dev server has no ASSETS binding, but
        // same-origin HTTP works there (production never reaches this —
        // self-fetch is blocked, ASSETS is not)
        () => fetch(new URL(artPath, c.req.url)),
      ];
      for (const attempt of attempts) {
        try {
          const resp = await attempt();
          if (!resp.ok || !(resp.headers.get("content-type") ?? "").startsWith("image/")) continue;
          const bytes = await resp.arrayBuffer();
          c.executionCtx.waitUntil(
            c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "image/webp" } }),
          );
          return new Response(bytes, {
            headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400" },
          });
        } catch {
          // try the next source
        }
      }
    }
    return c.text("This little one seems to have wandered off.", 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
});

// ---------- minimal app data (post-claim dashboard) ----------

api.get("/me", async (c) => {
  const user = await getAuthedUser(c.env, c.req.raw);
  if (!user) return c.json({ user: null }, 401);
  return c.json({ user });
});

api.get("/animals", async (c) => {
  const user = await getAuthedUser(c.env, c.req.raw);
  if (!user) return c.json({ error: "Please sign in." }, 401);
  const animals = await c.env.DB.prepare(
    `SELECT a.*, (SELECT r2_key FROM animal_photos p WHERE p.animal_id = a.id LIMIT 1) photo_key,
       (SELECT COUNT(*) FROM medical_records m WHERE m.animal_id = a.id) medical_count
     FROM animals a WHERE a.org_id = ? ORDER BY a.name LIMIT 500`,
  )
    .bind(user.org_id)
    .all();
  return c.json({ animals: animals.results });
});

// ---------- one-click full data export ----------

// "Own your data" means ALL of it — every org-scoped table ships in the
// export. When a migration adds an org-scoped table, add it here too.
const EXPORT_TABLES: { name: string; sql: string }[] = [
  { name: "animals", sql: `SELECT * FROM animals WHERE org_id = ?` },
  { name: "contacts", sql: `SELECT * FROM contacts WHERE org_id = ?` },
  { name: "medical_records", sql: `SELECT * FROM medical_records WHERE org_id = ?` },
  { name: "adoptions", sql: `SELECT * FROM adoptions WHERE org_id = ?` },
  { name: "applications", sql: `SELECT * FROM applications WHERE org_id = ?` },
  { name: "foster_assignments", sql: `SELECT * FROM foster_assignments WHERE org_id = ?` },
  { name: "donations", sql: `SELECT * FROM donations WHERE org_id = ?` },
  { name: "campaigns", sql: `SELECT * FROM campaigns WHERE org_id = ?` },
  { name: "animal_photos", sql: `SELECT * FROM animal_photos WHERE org_id = ?` },
  { name: "tasks", sql: `SELECT * FROM tasks WHERE org_id = ?` },
  { name: "locations", sql: `SELECT * FROM locations WHERE org_id = ?` },
  { name: "pages", sql: `SELECT * FROM pages WHERE org_id = ?` },
  { name: "media", sql: `SELECT * FROM media WHERE org_id = ?` },
  { name: "waitlist_subscriptions", sql: `SELECT * FROM waitlist_subscriptions WHERE org_id = ?` },
  { name: "followups", sql: `SELECT * FROM followups WHERE org_id = ?` },
  { name: "shifts", sql: `SELECT * FROM shifts WHERE org_id = ?` },
  { name: "shift_signups", sql: `SELECT * FROM shift_signups WHERE org_id = ?` },
  { name: "grant_drafts", sql: `SELECT * FROM grant_drafts WHERE org_id = ?` },
  { name: "transfer_posts", sql: `SELECT * FROM transfer_posts WHERE org_id = ?` },
  { name: "marketing_campaigns", sql: `SELECT * FROM marketing_campaigns WHERE org_id = ?` },
  { name: "marketing_assets", sql: `SELECT * FROM marketing_assets WHERE org_id = ?` },
  { name: "billing_usage", sql: `SELECT * FROM billing_usage WHERE org_id = ?` },
  { name: "email_suppression", sql: `SELECT * FROM email_suppression WHERE org_id = ?` },
  { name: "ai_usage", sql: `SELECT * FROM ai_usage WHERE org_id = ?` },
  { name: "ai_audit", sql: `SELECT * FROM ai_audit WHERE org_id = ?` },
  // never export password material
  { name: "users", sql: `SELECT id, org_id, email, name, created_at FROM users WHERE org_id = ?` },
];

api.get("/export.zip", async (c) => {
  const user = await getAuthedUser(c.env, c.req.raw);
  if (!user) return c.json({ error: "Please sign in." }, 401);

  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  for (const table of EXPORT_TABLES) {
    const rows = await c.env.DB.prepare(table.sql).bind(user.org_id).all<Record<string, unknown>>();
    const cols = rows.results.length ? Object.keys(rows.results[0]) : [];
    const csv = toCsv([
      cols,
      ...rows.results.map((r) => cols.map((col) => (r[col] == null ? "" : String(r[col])))),
    ]);
    files[`${table.name}.csv`] = strToU8(csv);
  }
  files["README.txt"] = strToU8(
    `Tutela full export for ${user.org_name}\n` +
      `Exported ${new Date().toISOString()}\n\n` +
      `Every table you own, in plain CSV. This data is yours — no strings attached.\n` +
      `Photo files referenced in animal_photos.csv can be fetched at /api/media/<r2_key>.\n`,
  );
  const zipped = zipSync(files, { level: 6 });

  return new Response(zipped.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="via-tutela-export.zip"`,
    },
  });
});

// ---------- Public share kit: photos + blurb for one adoptable friend ----------

api.get("/share-kit/:slug/:file", async (c) => {
  const animalId = c.req.param("file").replace(/\.zip$/, "");
  const org = await c.env.DB.prepare(`SELECT id, name, slug FROM orgs WHERE slug = ?`)
    .bind(c.req.param("slug"))
    .first<{ id: string; name: string; slug: string }>();
  if (!org) return c.json({ error: "Not found" }, 404);
  const animal = await c.env.DB.prepare(
    `SELECT id, name, species, breed, sex, description, bonded_group_id FROM animals
     WHERE id = ? AND org_id = ? AND is_public = 1`,
  )
    .bind(animalId, org.id)
    .first<Record<string, unknown>>();
  if (!animal) return c.json({ error: "Not found" }, 404);

  const photos = await c.env.DB.prepare(
    `SELECT r2_key FROM animal_photos WHERE animal_id = ? AND kind != 'video' ORDER BY created_at LIMIT 8`,
  )
    .bind(animal.id)
    .all<{ r2_key: string }>();

  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  let budget = 30 * 1024 * 1024; // keep the zip friendly to phones
  let i = 0;
  for (const p of photos.results) {
    const obj = await c.env.MEDIA.get(p.r2_key);
    if (!obj) continue;
    const buf = new Uint8Array(await obj.arrayBuffer());
    if (buf.byteLength > budget) continue;
    budget -= buf.byteLength;
    i++;
    const ext = p.r2_key.split(".").pop() ?? "jpg";
    files[`${String(animal.name).replace(/[^\w-]/g, "_")}-${i}.${ext}`] = buf;
  }
  const pageUrl = `${new URL(c.req.url).origin}/adopt/${org.slug}/${animal.id}`;
  const facts = [animal.breed ?? animal.species, animal.sex].filter(Boolean).join(", ");
  files["share-text.txt"] = strToU8(
    `${String(animal.name)}${facts ? ` (${facts})` : ""} is looking for a home at ${org.name}.\n` +
      (animal.bonded_group_id ? `They're part of a bonded pair — they go home together.\n` : "") +
      (animal.description ? `\n${String(animal.description)}\n` : "") +
      `\nMeet them: ${pageUrl}\n\nThank you for sharing — it's how friends get found. 💛\n`,
  );
  const zipped = zipSync(files, { level: 6 });
  return new Response(zipped.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${String(animal.name).replace(/[^\w-]/g, "_")}-share-kit.zip"`,
      "Cache-Control": "public, max-age=300",
    },
  });
});

// ---------- Petfinder-format public feed ----------

api.get("/feeds/:slug/petfinder.csv", async (c) => {
  const org = await c.env.DB.prepare(`SELECT id, name FROM orgs WHERE slug = ?`)
    .bind(c.req.param("slug"))
    .first<{ id: string; name: string }>();
  if (!org) return c.text("not found", 404);

  const origin = new URL(c.req.url).origin;
  const animals = await c.env.DB.prepare(
    `SELECT a.*, (SELECT GROUP_CONCAT(r2_key, '|') FROM animal_photos p WHERE p.animal_id = a.id) photo_keys
     FROM animals a WHERE a.org_id = ? AND a.is_public = 1 AND a.status = 'available'
     ORDER BY a.name`,
  )
    .bind(org.id)
    .all<Record<string, unknown>>();

  const csv = toCsv([
    ["ID", "Name", "Type", "Breed", "Sex", "Age", "Altered", "Description", "Status", "Photo1", "Photo2", "Photo3"],
    ...animals.results.map((a) => {
      const photos = String(a.photo_keys ?? "")
        .split("|")
        .filter(Boolean)
        .slice(0, 3)
        .map((k) => `${origin}/api/media/${k}`);
      return [
        a.source_key ? String(a.source_key) : String(a.id),
        String(a.name),
        String(a.species ?? ""),
        String(a.breed ?? ""),
        a.sex === "male" ? "M" : a.sex === "female" ? "F" : "U",
        String(a.dob ?? ""),
        a.altered == null ? "" : a.altered ? "Yes" : "No",
        String(a.description ?? ""),
        "Available",
        photos[0] ?? "",
        photos[1] ?? "",
        photos[2] ?? "",
      ];
    }),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});

api.notFound((c) =>
  c.json({ error: "This little one seems to have wandered off. Let's get you back home." }, 404),
);
