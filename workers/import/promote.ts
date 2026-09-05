/**
 * Promote a completed import's staged data into real tables under a
 * freshly created org. Relationship links (medical -> animal,
 * adoption -> animal/contact, bonded groups, photos) are carried across
 * via id maps.
 */

import { newId } from "../lib/ids";

export function normalizeEmail(email: string | null | undefined): string | null {
  const t = (email ?? "").trim().toLowerCase();
  return t && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? t : null;
}

export function splitRoles(roles: string | null | undefined): Set<string> {
  return new Set(
    (roles ?? "")
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean),
  );
}

export interface PromoteResult {
  animals: number;
  contacts: number;
  contactsMerged: number;
  medical: number;
  adoptions: number;
  photos: number;
}

export async function promoteImport(
  db: D1Database,
  jobId: string,
  orgId: string,
): Promise<PromoteResult> {
  const result: PromoteResult = { animals: 0, contacts: 0, contactsMerged: 0, medical: 0, adoptions: 0, photos: 0 };

  // ---- animals ----
  const animals = await db
    .prepare(`SELECT * FROM staging_animals WHERE job_id = ?`)
    .bind(jobId)
    .all<Record<string, unknown>>();
  const animalMap = new Map<string, string>(); // staging id -> real id
  const groupMap = new Map<string, string>(); // staging group -> real group
  {
    const stmts: D1PreparedStatement[] = [];
    for (const a of animals.results) {
      const id = newId("an");
      animalMap.set(a.id as string, id);
      let groupId: string | null = null;
      if (a.bonded_group_id) {
        const sg = a.bonded_group_id as string;
        if (!groupMap.has(sg)) groupMap.set(sg, newId("bg"));
        groupId = groupMap.get(sg)!;
      }
      stmts.push(
        db
          .prepare(
            `INSERT INTO animals
             (id, org_id, source_key, name, species, breed, sex, dob, altered, microchip,
              status, description, bonded_group_id, intake_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id, orgId,
            a.source_key ?? null, a.name, a.species ?? null, a.breed ?? null, a.sex ?? null,
            a.dob ?? null, a.altered ?? null, a.microchip ?? null,
            a.status ?? "available", a.description ?? null, groupId, a.intake_date ?? null,
          ),
      );
      result.animals++;
    }
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  }

  // ---- contacts, deduped by normalized email ----
  // Real shelter exports repeat the same person: an adopter who later
  // fosters, a donor who eventually adopts, the same family across
  // several years. Without this, each appearance becomes a separate
  // contact — the exact "botched migration" failure that erodes trust
  // fastest, since it silently fragments someone's whole history.
  const contacts = await db
    .prepare(`SELECT * FROM staging_contacts WHERE job_id = ? ORDER BY row_num ASC`)
    .bind(jobId)
    .all<Record<string, unknown>>();
  const contactMap = new Map<string, string>(); // staging id -> real id
  interface MergedContact {
    id: string;
    sourceKey: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    roles: Set<string>;
  }
  const byEmail = new Map<string, MergedContact>();
  const withoutEmail: { stagingId: string; row: Record<string, unknown> }[] = [];

  for (const c of contacts.results) {
    const email = normalizeEmail(c.email as string | null);
    const roles = splitRoles(c.roles as string | null);
    if (!email) {
      withoutEmail.push({ stagingId: c.id as string, row: c });
      continue;
    }
    const existing = byEmail.get(email);
    if (existing) {
      result.contactsMerged++;
      contactMap.set(c.id as string, existing.id);
      for (const r of roles) existing.roles.add(r);
      // fill in whatever the earlier appearance was missing
      if (!existing.name && c.name) existing.name = c.name as string;
      if (!existing.phone && c.phone) existing.phone = c.phone as string;
      if (!existing.address && c.address) existing.address = c.address as string;
    } else {
      const id = newId("ct");
      contactMap.set(c.id as string, id);
      byEmail.set(email, {
        id,
        sourceKey: (c.source_key as string) ?? null,
        name: (c.name as string) ?? "",
        email: c.email as string | null,
        phone: (c.phone as string) ?? null,
        address: (c.address as string) ?? null,
        roles,
      });
    }
  }

  {
    const stmts: D1PreparedStatement[] = [];
    for (const c of byEmail.values()) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO contacts (id, org_id, source_key, name, email, phone, address, roles)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(c.id, orgId, c.sourceKey, c.name || "Unknown", c.email, c.phone, c.address, [...c.roles].join(",") || null),
      );
      result.contacts++;
    }
    for (const { stagingId, row: c } of withoutEmail) {
      const id = newId("ct");
      contactMap.set(stagingId, id);
      stmts.push(
        db
          .prepare(
            `INSERT INTO contacts (id, org_id, source_key, name, email, phone, address, roles)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id, orgId,
            c.source_key ?? null, c.name, c.email ?? null, c.phone ?? null,
            c.address ?? null, c.roles ?? null,
          ),
      );
      result.contacts++;
    }
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  }

  // ---- medical (only rows that resolved to an animal) ----
  const medical = await db
    .prepare(`SELECT * FROM staging_medical WHERE job_id = ? AND staging_animal_id IS NOT NULL`)
    .bind(jobId)
    .all<Record<string, unknown>>();
  {
    const stmts: D1PreparedStatement[] = [];
    for (const m of medical.results) {
      const animalId = animalMap.get(m.staging_animal_id as string);
      if (!animalId) continue;
      stmts.push(
        db
          .prepare(
            `INSERT INTO medical_records (id, org_id, animal_id, source_key, date, type, description, vet)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            newId("md"), orgId, animalId,
            m.source_key ?? null, m.date ?? null, m.type ?? null,
            m.description ?? null, m.vet ?? null,
          ),
      );
      result.medical++;
    }
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  }

  // ---- adoptions ----
  const adoptions = await db
    .prepare(`SELECT * FROM staging_adoptions WHERE job_id = ? AND staging_animal_id IS NOT NULL`)
    .bind(jobId)
    .all<Record<string, unknown>>();
  {
    const stmts: D1PreparedStatement[] = [];
    for (const ad of adoptions.results) {
      const animalId = animalMap.get(ad.staging_animal_id as string);
      if (!animalId) continue;
      const contactId = ad.staging_contact_id
        ? (contactMap.get(ad.staging_contact_id as string) ?? null)
        : null;
      stmts.push(
        db
          .prepare(
            `INSERT INTO adoptions (id, org_id, animal_id, contact_id, source_key, date, fee, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            newId("ad"), orgId, animalId, contactId,
            ad.source_key ?? null, ad.date ?? null, ad.fee ?? null, ad.status ?? "completed",
          ),
      );
      result.adoptions++;
    }
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  }

  // ---- photos (R2 objects stay where they are; rows point at them) ----
  const photos = await db
    .prepare(`SELECT * FROM staging_photos WHERE job_id = ?`)
    .bind(jobId)
    .all<Record<string, unknown>>();
  {
    const stmts: D1PreparedStatement[] = [];
    for (const p of photos.results) {
      const animalId = animalMap.get(p.staging_animal_id as string);
      if (!animalId) continue;
      stmts.push(
        db
          .prepare(
            `INSERT INTO animal_photos (id, org_id, animal_id, r2_key, source_url)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(newId("ph"), orgId, animalId, p.r2_key, p.source_url ?? null),
      );
      result.photos++;
    }
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  }

  await db
    .prepare(`UPDATE import_jobs SET status = 'claimed', org_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(orgId, jobId)
    .run();

  return result;
}
