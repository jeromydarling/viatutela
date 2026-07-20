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
import {
  SAMPLE_EVENTS,
  buildShiftsIcs,
  cleanEventList,
  decodeCursor,
  emitEvent,
  encodeCursor,
  validateWebhookUrl,
  verifyApiKey,
  type ApiKeyAuth,
  type IcsShift,
} from "./lib/integrations";
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
  // thumbnail variants: ?w=240|480|960 resizes images via the Images
  // binding (each unique source+params combo is billed once a month and
  // cached platform-side; immutable below handles the browser). Full-size
  // originals serve untouched.
  const contentType = obj.httpMetadata?.contentType ?? "";
  const w = Number(c.req.query("w") ?? 0);
  if ([240, 480, 960].includes(w) && contentType.startsWith("image/")) {
    try {
      const result = await c.env.IMAGES.input(obj.body)
        .transform({ width: w, fit: "scale-down" })
        .output({ format: "image/webp", quality: 78 });
      return new Response(result.image(), {
        headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
      });
    } catch {
      // Images unavailable — refetch and serve the original (obj.body is spent)
      const fresh = await c.env.MEDIA.get(key);
      if (fresh) {
        const headers = new Headers();
        fresh.writeHttpMetadata(headers);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(fresh.body, { headers });
      }
      return c.text("This little one seems to have wandered off.", 404);
    }
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
  // never export password material — and never key hashes or webhook secrets
  { name: "users", sql: `SELECT id, org_id, email, name, created_at FROM users WHERE org_id = ?` },
  { name: "api_keys", sql: `SELECT id, org_id, name, prefix, scope, created_at, last_used_at, revoked_at FROM api_keys WHERE org_id = ?` },
  { name: "webhooks", sql: `SELECT id, org_id, url, events, active, failure_count, last_status, last_delivery_at, created_at FROM webhooks WHERE org_id = ?` },
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

// ---------- pet-of-the-week press kit (for local TV / newspapers) ----------

api.get("/press-kit/:slug/:file", async (c) => {
  const animalId = c.req.param("file").replace(/\.zip$/, "");
  const org = await c.env.DB.prepare(
    `SELECT id, name, slug, email, phone, address, website FROM orgs WHERE slug = ?`,
  )
    .bind(c.req.param("slug"))
    .first<Record<string, string | null>>();
  if (!org) return c.json({ error: "Not found" }, 404);
  const animal = await c.env.DB.prepare(
    `SELECT id, name, species, breed, sex, dob, description, bonded_group_id, intake_date FROM animals
     WHERE id = ? AND org_id = ? AND is_public = 1`,
  )
    .bind(animalId, org.id)
    .first<Record<string, unknown>>();
  if (!animal) return c.json({ error: "Not found" }, 404);

  const photos = await c.env.DB.prepare(
    `SELECT r2_key FROM animal_photos WHERE animal_id = ? AND kind != 'video' ORDER BY created_at LIMIT 4`,
  )
    .bind(animal.id)
    .all<{ r2_key: string }>();

  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  let budget = 25 * 1024 * 1024;
  let i = 0;
  for (const p of photos.results) {
    const obj = await c.env.MEDIA.get(p.r2_key);
    if (!obj) continue;
    const buf = new Uint8Array(await obj.arrayBuffer());
    if (buf.byteLength > budget) continue;
    budget -= buf.byteLength;
    i++;
    const ext = p.r2_key.split(".").pop() ?? "jpg";
    files[`photos/${String(animal.name).replace(/[^\w-]/g, "_")}-${i}.${ext}`] = buf;
  }

  const pageUrl = `${new URL(c.req.url).origin}/adopt/${org.slug}/${animal.id}`;
  const name = String(animal.name);
  const facts = [animal.breed ?? animal.species, animal.sex].filter(Boolean).join(", ");

  files["press-release.txt"] = strToU8(
    `FOR IMMEDIATE RELEASE

${String(org.name).toUpperCase()} HOPES TO FIND A HOME FOR ${name.toUpperCase()} THIS WEEK

${name}${facts ? ` (${facts})` : ""} is this week's featured friend at ${org.name}.
${animal.bonded_group_id ? `${name} is part of a bonded pair — they will be adopted together.\n` : ""}
${animal.description ? `${String(animal.description)}\n` : ""}
${name}'s full profile, photos, and adoption application are at:
${pageUrl}

ABOUT ${String(org.name).toUpperCase()}
${org.address ? `Located at ${org.address}. ` : ""}${org.website ? `More at ${org.website}. ` : ""}Every adoption opens a kennel for the next animal in need.

MEDIA CONTACT
${org.name}
${org.email ?? ""}
${org.phone ?? ""}

Photos: print-quality images are included in this kit and may be used with credit to ${org.name}.
`,
  );
  files["fact-sheet.txt"] = strToU8(
    [
      `Name: ${name}`,
      `Species: ${animal.species ?? "—"}`,
      `Breed: ${animal.breed ?? "—"}`,
      `Sex: ${animal.sex ?? "—"}`,
      animal.dob ? `Born: ${animal.dob}` : null,
      animal.intake_date ? `In care since: ${animal.intake_date}` : null,
      animal.bonded_group_id ? `Bonded pair: yes — adopted together` : null,
      `Adoption page: ${pageUrl}`,
      `Shelter: ${org.name}${org.address ? `, ${org.address}` : ""}`,
    ]
      .filter(Boolean)
      .join("\n") + "\n",
  );

  const zipped = zipSync(files, { level: 6 });
  return new Response(zipped.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name.replace(/[^\w-]/g, "_")}-press-kit.zip"`,
      "Cache-Control": "public, max-age=300",
    },
  });
});

// ---------- the friend booklet (print-ready PDF keepsake) ----------

api.get("/booklet/:slug/:file", async (c) => {
  const animalId = c.req.param("file").replace(/\.pdf$/, "");
  const org = await c.env.DB.prepare(
    `SELECT id, name, slug, email, phone, address, website FROM orgs WHERE slug = ?`,
  )
    .bind(c.req.param("slug"))
    .first<Record<string, string | null>>();
  if (!org) return c.json({ error: "Not found" }, 404);
  const animal = await c.env.DB.prepare(
    `SELECT id, name, species, breed, sex, dob, description, bonded_group_id, microchip, intake_date
     FROM animals WHERE id = ? AND org_id = ? AND is_public = 1`,
  )
    .bind(animalId, org.id)
    .first<Record<string, unknown>>();
  if (!animal) return c.json({ error: "Not found" }, 404);

  const [photos, medical] = await Promise.all([
    c.env.DB.prepare(
      `SELECT r2_key FROM animal_photos WHERE animal_id = ? AND kind != 'video' ORDER BY created_at LIMIT 3`,
    ).bind(animal.id).all<{ r2_key: string }>(),
    c.env.DB.prepare(
      `SELECT date, type, description FROM medical_records WHERE animal_id = ? ORDER BY date DESC LIMIT 10`,
    ).bind(animal.id).all<{ date: string | null; type: string | null; description: string | null }>(),
  ]);

  // photos live as webp; pdf-lib wants jpeg — the Images binding converts
  const photoJpegs: Uint8Array[] = [];
  for (const p of photos.results) {
    try {
      const obj = await c.env.MEDIA.get(p.r2_key);
      if (!obj) continue;
      const jpeg = await c.env.IMAGES.input(obj.body)
        .transform({ width: 1000 })
        .output({ format: "image/jpeg", quality: 85 });
      photoJpegs.push(new Uint8Array(await jpeg.response().arrayBuffer()));
    } catch {
      // skip unconvertible photos
    }
  }

  const { buildBooklet } = await import("./lib/booklet");
  const pdf = await buildBooklet({
    animal: {
      name: String(animal.name),
      species: animal.species ? String(animal.species) : null,
      breed: animal.breed ? String(animal.breed) : null,
      sex: animal.sex ? String(animal.sex) : null,
      dob: animal.dob ? String(animal.dob) : null,
      description: animal.description ? String(animal.description) : null,
      bonded: Boolean(animal.bonded_group_id),
      microchip: animal.microchip ? String(animal.microchip) : null,
      intake_date: animal.intake_date ? String(animal.intake_date) : null,
    },
    org: {
      name: String(org.name),
      email: org.email,
      phone: org.phone,
      address: org.address,
      website: org.website,
    },
    medical: medical.results,
    photoJpegs,
    pageUrl: `${new URL(c.req.url).origin}/adopt/${org.slug}/${animal.id}`,
  });

  return new Response(pdf.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${String(animal.name).replace(/[^\w-]/g, "_")}-booklet.pdf"`,
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

// ---------- REST API v1 (per-org API keys — Zapier/Make/n8n plumbing) ----------

/** Column whitelists per resource — never SELECT *. Users/passwords and
 * medical records are deliberately not exposed. */
const V1_RESOURCES: Record<string, string> = {
  animals: `SELECT id, name, species, breed, sex, dob, altered, microchip, status, kennel, color, weight,
    description, bonded_group_id, intake_date, is_public, created_at,
    (SELECT r2_key FROM animal_photos p WHERE p.animal_id = animals.id LIMIT 1) photo_key
    FROM animals`,
  contacts: `SELECT id, name, email, phone, address, roles, created_at FROM contacts`,
  applications: `SELECT id, animal_id, name, email, phone, home_type, message, interest, status, created_at, decided_at FROM applications`,
  donations: `SELECT id, contact_id, campaign_id, donor_name, email, amount, method, note, date, created_at FROM donations`,
  adoptions: `SELECT id, animal_id, contact_id, date, fee, status, created_at FROM adoptions`,
};

const V1_RATE_LIMIT = 120; // requests per key per minute

async function v1Auth(c: any): Promise<ApiKeyAuth | Response> {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return c.json({ error: "Missing API key. Send it as: Authorization: Bearer vt_live_…" }, 401);
  }
  const key = await verifyApiKey(c.env, token);
  if (!key) return c.json({ error: "That API key isn't valid — it may have been revoked." }, 401);

  try {
    const bucket = Math.floor(Date.now() / 60_000);
    const rlKey = `akrl:${key.keyId}:${bucket}`;
    const n = Number((await c.env.CONFIG.get(rlKey)) ?? "0") + 1;
    if (n > V1_RATE_LIMIT) {
      return c.json({ error: `Rate limit exceeded (${V1_RATE_LIMIT} requests/minute).` }, 429);
    }
    await c.env.CONFIG.put(rlKey, String(n), { expirationTtl: 120 });
  } catch {
    // KV hiccups never block API traffic
  }

  const lastUsed = key.lastUsedAt ? Date.parse(key.lastUsedAt.replace(" ", "T") + "Z") : 0;
  if (!lastUsed || lastUsed < Date.now() - 300_000) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`)
        .bind(key.keyId)
        .run()
        .then(() => {}),
    );
  }
  return key;
}

// ---------- Stripe webhooks (donations land here, incl. from connected accounts) ----------

api.post("/stripe/webhook", async (c) => {
  const { verifyStripeSignature } = await import("./lib/stripe");
  const payload = await c.req.text();
  const valid = await verifyStripeSignature(c.env, payload, c.req.header("stripe-signature") ?? null);
  if (!valid) return c.json({ error: "bad signature" }, 400);

  let event: { type?: string; account?: string; data?: { object?: Record<string, any> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return c.json({ error: "bad payload" }, 400);
  }
  const obj = event.data?.object ?? {};

  try {
    if (event.type === "checkout.session.completed" && obj.mode === "payment") {
      await recordStripeDonation(c, {
        orgId: String(obj.metadata?.org_id ?? ""),
        sessionId: String(obj.id ?? ""),
        totalCents: Number(obj.amount_total ?? 0),
        coverCents: Number(obj.metadata?.cover_cents ?? 0),
        email: obj.customer_details?.email ? String(obj.customer_details.email) : null,
        name: obj.customer_details?.name ? String(obj.customer_details.name) : null,
        recurring: false,
      });
    } else if (event.type === "invoice.paid") {
      const meta =
        obj.subscription_details?.metadata ??
        obj.parent?.subscription_details?.metadata ??
        obj.lines?.data?.[0]?.metadata ??
        {};
      await recordStripeDonation(c, {
        orgId: String(meta.org_id ?? ""),
        sessionId: String(obj.id ?? ""), // invoice id — one donation row per billing cycle
        totalCents: Number(obj.amount_paid ?? 0),
        coverCents: Number(meta.cover_cents ?? 0),
        email: obj.customer_email ? String(obj.customer_email) : null,
        name: obj.customer_name ? String(obj.customer_name) : null,
        recurring: true,
      });
    } else if (event.type === "account.updated" && obj.id) {
      await c.env.DB.prepare(`UPDATE orgs SET stripe_charges_enabled = ? WHERE stripe_account_id = ?`)
        .bind(obj.charges_enabled ? 1 : 0, String(obj.id))
        .run();
    }
  } catch (err) {
    // Log and 200 anyway: Stripe retries on non-2xx, and a poison event
    // must not block the queue. Idempotency comes from stripe_session_id.
    console.log(`[stripe webhook] ${event.type}: ${err instanceof Error ? err.message : err}`);
  }
  return c.json({ received: true });
});

async function recordStripeDonation(
  c: { env: Env; executionCtx: unknown },
  d: {
    orgId: string;
    sessionId: string;
    totalCents: number;
    coverCents: number;
    email: string | null;
    name: string | null;
    recurring: boolean;
  },
): Promise<void> {
  if (!d.orgId || !d.sessionId || d.totalCents <= 0) return;
  const org = await c.env.DB.prepare(`SELECT id FROM orgs WHERE id = ?`).bind(d.orgId).first();
  if (!org) return;
  const existing = await c.env.DB.prepare(`SELECT id FROM donations WHERE stripe_session_id = ?`)
    .bind(d.sessionId)
    .first();
  if (existing) return; // Stripe retried delivery — already recorded

  // the gift is what the shelter keeps conceptually; fee cover is tracked apart
  const baseCents = Math.max(d.totalCents - d.coverCents, 0);
  const amount = baseCents / 100;
  const feeCovered = d.coverCents > 0 ? d.coverCents / 100 : null;

  let contactId: string | null = null;
  if (d.email) {
    const email = d.email.trim().toLowerCase();
    const existingContact = await c.env.DB.prepare(
      `SELECT id, roles FROM contacts WHERE org_id = ? AND email = ?`,
    )
      .bind(d.orgId, email)
      .first<{ id: string; roles: string | null }>();
    if (existingContact) {
      contactId = existingContact.id;
      const roles = new Set((existingContact.roles ?? "").split(",").filter(Boolean));
      roles.add("donor");
      await c.env.DB.prepare(`UPDATE contacts SET roles = ? WHERE id = ?`)
        .bind([...roles].join(","), contactId)
        .run();
    } else {
      contactId = newId("ct");
      await c.env.DB.prepare(
        `INSERT INTO contacts (id, org_id, name, email, roles) VALUES (?, ?, ?, ?, 'donor')`,
      )
        .bind(contactId, d.orgId, d.name?.slice(0, 120) || email.split("@")[0], email)
        .run();
    }
  }

  const id = newId("dn");
  await c.env.DB.prepare(
    `INSERT INTO donations (id, org_id, contact_id, donor_name, email, amount, method, note, date, stripe_session_id, recurring, fee_covered)
     VALUES (?, ?, ?, ?, ?, ?, 'online', ?, date('now'), ?, ?, ?)`,
  )
    .bind(
      id, d.orgId, contactId, contactId ? null : d.name?.slice(0, 120) ?? null,
      d.email, amount, d.recurring ? "Monthly gift via Stripe" : "One-time gift via Stripe",
      d.sessionId, d.recurring ? 1 : 0, feeCovered,
    )
    .run();

  await emitEvent(c.env, c.executionCtx as unknown as ExecutionContext, d.orgId, "donation.created", {
    id,
    contact_id: contactId,
    donor_name: d.name,
    email: d.email,
    amount,
    method: "online",
    date: new Date().toISOString().slice(0, 10),
  });
}

// -- auth test / connection label (Zapier calls this when a key is connected)
api.get("/v1/me", async (c) => {
  const key = await v1Auth(c);
  if (key instanceof Response) return key;
  const org = await c.env.DB.prepare(`SELECT id, name, slug FROM orgs WHERE id = ?`)
    .bind(key.orgId)
    .first<{ id: string; name: string; slug: string }>();
  return c.json({ org_id: org?.id, org_name: org?.name, slug: org?.slug, scope: key.scope });
});

// -- REST hook subscriptions (Zapier subscribes on Zap-on, unsubscribes on Zap-off)
const API_HOOK_LIMIT = 30;

api.get("/v1/hooks", async (c) => {
  const key = await v1Auth(c);
  if (key instanceof Response) return key;
  const rows = await c.env.DB.prepare(
    `SELECT id, url, events, active, created_at FROM webhooks WHERE org_id = ? ORDER BY created_at DESC LIMIT 50`,
  ).bind(key.orgId).all();
  return c.json({ data: rows.results });
});

api.post("/v1/hooks", async (c) => {
  const key = await v1Auth(c);
  if (key instanceof Response) return key;
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Send a JSON body." }, 400);
  }
  const checked = validateWebhookUrl(String(body.url ?? ""));
  if (!checked.ok) return c.json({ error: checked.error }, 400);
  const rawEvents = Array.isArray(body.events) ? body.events.map(String) : [String(body.events ?? "")];
  const events = cleanEventList(rawEvents);
  if (!events) return c.json({ error: "events must include at least one known event." }, 400);
  const count = await c.env.DB.prepare(`SELECT COUNT(*) n FROM webhooks WHERE org_id = ?`)
    .bind(key.orgId)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= API_HOOK_LIMIT) {
    return c.json({ error: `Subscription limit reached (${API_HOOK_LIMIT}).` }, 409);
  }
  const id = newId("wh");
  const secret = newToken();
  await c.env.DB.prepare(`INSERT INTO webhooks (id, org_id, url, secret, events) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, key.orgId, checked.url, secret, events)
    .run();
  return c.json({ id, url: checked.url, events: events.split(","), secret }, 201);
});

api.delete("/v1/hooks/:id", async (c) => {
  const key = await v1Auth(c);
  if (key instanceof Response) return key;
  const id = c.req.param("id");
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM webhook_deliveries WHERE webhook_id = ? AND org_id = ?`).bind(id, key.orgId),
    c.env.DB.prepare(`DELETE FROM webhooks WHERE id = ? AND org_id = ?`).bind(id, key.orgId),
  ]);
  // idempotent by design — unsubscribing twice is fine
  return c.json({ ok: true });
});

// -- per-event samples, shaped exactly like webhook `data` payloads
api.get("/v1/samples/:event", async (c) => {
  const key = await v1Auth(c);
  if (key instanceof Response) return key;
  const event = c.req.param("event");
  const canned = SAMPLE_EVENTS[event];
  if (!canned) return c.json({ error: `Unknown event. Available: ${Object.keys(SAMPLE_EVENTS).join(", ")}` }, 404);

  let rows: Record<string, unknown>[] = [];
  if (event === "application.created") {
    const r = await c.env.DB.prepare(
      `SELECT ap.id, ap.animal_id, a.name animal_name, ap.name, ap.email, ap.interest
       FROM applications ap LEFT JOIN animals a ON a.id = ap.animal_id
       WHERE ap.org_id = ? ORDER BY ap.created_at DESC LIMIT 3`,
    ).bind(key.orgId).all<Record<string, unknown>>();
    rows = r.results;
  } else if (event === "adoption.created") {
    const r = await c.env.DB.prepare(
      `SELECT ad.id, ad.animal_id, a.name animal_name, ad.contact_id, ct.name adopter_name, ad.date
       FROM adoptions ad LEFT JOIN animals a ON a.id = ad.animal_id LEFT JOIN contacts ct ON ct.id = ad.contact_id
       WHERE ad.org_id = ? ORDER BY ad.created_at DESC LIMIT 3`,
    ).bind(key.orgId).all<Record<string, unknown>>();
    rows = r.results;
  } else if (event === "donation.created") {
    const r = await c.env.DB.prepare(
      `SELECT id, contact_id, donor_name, email, amount, method, date
       FROM donations WHERE org_id = ? ORDER BY created_at DESC LIMIT 3`,
    ).bind(key.orgId).all<Record<string, unknown>>();
    rows = r.results;
  } else if (event === "animal.created") {
    const r = await c.env.DB.prepare(
      `SELECT id, name, species, breed, status, is_public
       FROM animals WHERE org_id = ? ORDER BY created_at DESC LIMIT 3`,
    ).bind(key.orgId).all<Record<string, unknown>>();
    rows = r.results;
  } else if (event === "volunteer.signup") {
    const r = await c.env.DB.prepare(
      `SELECT sg.id, sg.shift_id, sh.title shift_title, sh.date shift_date, sg.contact_id, ct.name volunteer_name
       FROM shift_signups sg LEFT JOIN shifts sh ON sh.id = sg.shift_id LEFT JOIN contacts ct ON ct.id = sg.contact_id
       WHERE sg.org_id = ? ORDER BY sg.created_at DESC LIMIT 3`,
    ).bind(key.orgId).all<Record<string, unknown>>();
    rows = r.results;
  }
  return c.json({ data: rows.length ? rows : [canned] });
});

// -- write endpoints (require a read+write key) — Zapier "actions"

function requireWrite(c: any, key: ApiKeyAuth): Response | null {
  if (key.scope !== "write") {
    return c.json({ error: "This key is read-only. Create a read + write key in Settings → Integrations." }, 403);
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTACT_ROLES = ["adopter", "foster", "volunteer", "donor", "newsletter"];

/** Find-or-create a contact by email. Roles merge; name/phone fill blanks only. */
api.post("/v1/contacts", async (c) => {
  const key = await v1Auth(c);
  if (key instanceof Response) return key;
  const denied = requireWrite(c, key);
  if (denied) return denied;
  let b: Record<string, unknown>;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Send a JSON body." }, 400);
  }
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return c.json({ error: "A valid email is required." }, 400);
  const name = String(b.name ?? "").trim().slice(0, 120) || email.split("@")[0];
  const phone = String(b.phone ?? "").trim().slice(0, 40) || null;
  const address = String(b.address ?? "").trim().slice(0, 300) || null;
  const roles = String(b.roles ?? "")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter((r) => CONTACT_ROLES.includes(r));

  const existing = await c.env.DB.prepare(`SELECT id, name, phone, address, roles FROM contacts WHERE org_id = ? AND email = ?`)
    .bind(key.orgId, email)
    .first<{ id: string; name: string; phone: string | null; address: string | null; roles: string | null }>();
  if (existing) {
    const merged = new Set((existing.roles ?? "").split(",").filter(Boolean));
    for (const r of roles) merged.add(r);
    await c.env.DB.prepare(`UPDATE contacts SET roles = ?, phone = COALESCE(phone, ?), address = COALESCE(address, ?) WHERE id = ?`)
      .bind([...merged].join(","), phone, address, existing.id)
      .run();
    return c.json({ id: existing.id, email, name: existing.name, roles: [...merged].join(","), created: false });
  }
  const id = newId("ct");
  await c.env.DB.prepare(`INSERT INTO contacts (id, org_id, name, email, phone, address, roles) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, key.orgId, name, email, phone, address, roles.join(",") || null)
    .run();
  return c.json({ id, email, name, roles: roles.join(","), created: true }, 201);
});

api.post("/v1/donations", async (c) => {
  const key = await v1Auth(c);
  if (key instanceof Response) return key;
  const denied = requireWrite(c, key);
  if (denied) return denied;
  let b: Record<string, unknown>;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Send a JSON body." }, 400);
  }
  const amount = Number(b.amount);
  if (!isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return c.json({ error: "amount must be a positive number." }, 400);
  }
  let contactId = String(b.contact_id ?? "").trim() || null;
  if (contactId) {
    const owned = await c.env.DB.prepare(`SELECT id FROM contacts WHERE id = ? AND org_id = ?`)
      .bind(contactId, key.orgId)
      .first();
    if (!owned) return c.json({ error: "contact_id not found in this organization." }, 400);
  }
  const email = String(b.email ?? "").trim().toLowerCase() || null;
  const donorName = String(b.donor_name ?? "").trim().slice(0, 120) || null;
  const method = String(b.method ?? "").trim().slice(0, 30) || null;
  const note = String(b.note ?? "").trim().slice(0, 500) || null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date ?? "")) ? String(b.date) : null;

  const id = newId("dn");
  await c.env.DB.prepare(
    `INSERT INTO donations (id, org_id, contact_id, donor_name, email, amount, method, note, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')))`,
  )
    .bind(id, key.orgId, contactId, donorName, email, amount, method, note, date)
    .run();
  await emitEvent(c.env, c.executionCtx as unknown as ExecutionContext, key.orgId, "donation.created", {
    id, contact_id: contactId, donor_name: donorName, email, amount, method,
    date: date ?? new Date().toISOString().slice(0, 10),
  });
  return c.json({ id, amount, date: date ?? new Date().toISOString().slice(0, 10), created: true }, 201);
});

api.post("/v1/animals", async (c) => {
  const key = await v1Auth(c);
  if (key instanceof Response) return key;
  const denied = requireWrite(c, key);
  if (denied) return denied;
  let b: Record<string, unknown>;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: "Send a JSON body." }, 400);
  }
  const name = String(b.name ?? "").trim().slice(0, 120);
  if (!name) return c.json({ error: "Every friend needs a name." }, 400);
  const status = ["available", "pending", "in foster", "hold", "adopted"].includes(String(b.status))
    ? String(b.status)
    : "available";
  const id = newId("an");
  await c.env.DB.prepare(
    `INSERT INTO animals (id, org_id, name, species, breed, sex, dob, microchip, status, description, intake_date, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?)`,
  )
    .bind(
      id, key.orgId, name,
      String(b.species ?? "").trim().toLowerCase().slice(0, 40) || null,
      String(b.breed ?? "").trim().slice(0, 80) || null,
      ["male", "female"].includes(String(b.sex)) ? String(b.sex) : null,
      /^\d{4}-\d{2}-\d{2}$/.test(String(b.dob ?? "")) ? String(b.dob) : null,
      String(b.microchip ?? "").trim().slice(0, 40) || null,
      status,
      String(b.description ?? "").trim().slice(0, 4000) || null,
      /^\d{4}-\d{2}-\d{2}$/.test(String(b.intake_date ?? "")) ? String(b.intake_date) : null,
      b.is_public ? 1 : 0,
    )
    .run();
  await emitEvent(c.env, c.executionCtx as unknown as ExecutionContext, key.orgId, "animal.created", {
    id, name,
    species: String(b.species ?? "").trim().toLowerCase() || null,
    breed: String(b.breed ?? "").trim() || null,
    status, is_public: b.is_public ? 1 : 0,
  });
  return c.json({ id, name, status, created: true }, 201);
});

api.get("/v1/:resource", async (c) => {
  const key = await v1Auth(c);
  if (key instanceof Response) return key;

  const resource = c.req.param("resource");
  const base = V1_RESOURCES[resource];
  if (!base) {
    return c.json({ error: `Unknown resource. Available: ${Object.keys(V1_RESOURCES).join(", ")}` }, 404);
  }

  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50") || 50));
  let sql = `${base} WHERE org_id = ?`;
  const binds: unknown[] = [key.orgId];

  const since = c.req.query("since");
  if (since) {
    const normalized = since.replace("T", " ").replace(/Z$/, "").slice(0, 19);
    if (!/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
      return c.json({ error: "since must be an ISO date or datetime, e.g. 2026-07-01 or 2026-07-01T12:00:00Z" }, 400);
    }
    sql += ` AND created_at > ?`;
    binds.push(normalized);
  }

  // exact-match email filter (contacts/applications/donations) — powers
  // Zapier's "Find contact" search
  const email = c.req.query("email");
  if (email && ["contacts", "applications", "donations"].includes(resource)) {
    sql += ` AND email = ?`;
    binds.push(email.trim().toLowerCase());
  }

  const rawCursor = c.req.query("cursor");
  if (rawCursor) {
    const cursor = decodeCursor(rawCursor);
    if (!cursor) return c.json({ error: "Invalid cursor." }, 400);
    sql += ` AND (created_at < ? OR (created_at = ? AND id < ?))`;
    binds.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  sql += ` ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`;
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();

  const hasMore = rows.results.length > limit;
  const data = rows.results.slice(0, limit);
  if (resource === "animals") {
    const origin = new URL(c.req.url).origin;
    for (const row of data) {
      row.photo_url = row.photo_key ? `${origin}/api/media/${row.photo_key}` : null;
      delete row.photo_key;
    }
  }
  const last = data[data.length - 1];
  return c.json({
    data,
    next_cursor: hasMore && last ? encodeCursor(String(last.created_at), String(last.id)) : null,
  });
});

// ---------- volunteer shifts as a calendar feed (subscribe in Google/Apple Calendar) ----------

api.get("/feeds/shifts/:token", async (c) => {
  const token = c.req.param("token").replace(/\.ics$/, "");
  if (!/^[a-f0-9]{48}$/.test(token)) return c.text("not found", 404);
  const org = await c.env.DB.prepare(`SELECT id, name FROM orgs WHERE ics_token = ?`)
    .bind(token)
    .first<{ id: string; name: string }>();
  if (!org) return c.text("not found", 404);

  const shifts = await c.env.DB.prepare(
    `SELECT id, title, date, start_time, end_time, notes FROM shifts
     WHERE org_id = ? AND date >= date('now', '-7 days') AND date <= date('now', '+120 days')
     ORDER BY date, start_time LIMIT 500`,
  )
    .bind(org.id)
    .all<IcsShift>();

  return new Response(buildShiftsIcs(org.name, shifts.results), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=900",
      "Content-Disposition": `inline; filename="shifts.ics"`,
    },
  });
});

api.notFound((c) =>
  c.json({ error: "This little one seems to have wandered off. Let's get you back home." }, 404),
);
