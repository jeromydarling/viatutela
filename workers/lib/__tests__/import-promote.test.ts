import { describe, expect, it } from "vitest";
import { normalizeEmail, splitRoles, promoteImport } from "../../import/promote";

describe("normalizeEmail", () => {
  it("trims and lowercases valid emails", () => {
    expect(normalizeEmail("  Jane.Smith@Example.COM  ")).toBe("jane.smith@example.com");
  });
  it("rejects blank/invalid values", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
});

describe("splitRoles", () => {
  it("splits, trims, lowercases, and drops blanks", () => {
    expect([...splitRoles("Adopter, Foster ,")]).toEqual(["adopter", "foster"]);
  });
  it("handles null", () => {
    expect([...splitRoles(null)]).toEqual([]);
  });
});

// A minimal in-memory D1 stub covering exactly the queries promoteImport
// issues, so the real end-to-end merge/link behavior is exercised without
// a live database.
function fakeDb(seed: {
  animals: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
  medical?: Record<string, unknown>[];
  adoptions?: Record<string, unknown>[];
  photos?: Record<string, unknown>[];
}) {
  const out = {
    contacts: [] as Record<string, unknown>[],
    animals: [] as Record<string, unknown>[],
    medical: [] as Record<string, unknown>[],
    adoptions: [] as Record<string, unknown>[],
    photos: [] as Record<string, unknown>[],
  };

  function exec(sql: string, params: unknown[]) {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("SELECT * FROM staging_animals")) return { results: seed.animals };
    if (s.startsWith("SELECT * FROM staging_contacts")) {
      return { results: [...seed.contacts].sort((a, b) => Number(a.row_num) - Number(b.row_num)) };
    }
    if (s.startsWith("SELECT * FROM staging_medical")) {
      return { results: (seed.medical ?? []).filter((m) => m.staging_animal_id) };
    }
    if (s.startsWith("SELECT * FROM staging_adoptions")) {
      return { results: (seed.adoptions ?? []).filter((a) => a.staging_animal_id) };
    }
    if (s.startsWith("SELECT * FROM staging_photos")) return { results: seed.photos ?? [] };
    if (s.startsWith("INSERT INTO contacts")) {
      const [id, org_id, source_key, name, email, phone, address, roles] = params;
      out.contacts.push({ id, org_id, source_key, name, email, phone, address, roles });
      return { success: true };
    }
    if (s.startsWith("INSERT INTO animals")) {
      const [id, org_id] = params;
      out.animals.push({ id, org_id });
      return { success: true };
    }
    if (s.startsWith("INSERT INTO medical_records")) {
      const [id, org_id, animal_id] = params;
      out.medical.push({ id, org_id, animal_id });
      return { success: true };
    }
    if (s.startsWith("INSERT INTO adoptions")) {
      const [id, org_id, animal_id, contact_id] = params;
      out.adoptions.push({ id, org_id, animal_id, contact_id });
      return { success: true };
    }
    if (s.startsWith("INSERT INTO animal_photos")) {
      const [id, org_id, animal_id, r2_key, source_url] = params;
      out.photos.push({ id, org_id, animal_id, r2_key, source_url });
      return { success: true };
    }
    if (s.startsWith("UPDATE import_jobs")) return { success: true };
    throw new Error(`unhandled SQL in fake D1: ${s}`);
  }

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            _sql: sql,
            _params: params,
            all: async () => exec(sql, params),
            first: async () => (exec(sql, params).results ?? [null])[0] ?? null,
            run: async () => exec(sql, params),
          };
        },
      };
    },
    async batch(stmts: { _sql: string; _params: unknown[] }[]) {
      return stmts.map((s) => exec(s._sql, s._params));
    },
  };
  return { db: db as unknown as D1Database, out };
}

describe("promoteImport contact dedup", () => {
  it("merges the same person appearing twice in the export (case/whitespace-insensitive email match)", async () => {
    const { db, out } = fakeDb({
      animals: [{ id: "sa1", row_num: 1, name: "Waffle" }],
      contacts: [
        { id: "sc1", row_num: 1, name: "Jane Smith", email: "  Jane@Example.com ", phone: null, address: "1 Main St", roles: "adopter" },
        { id: "sc2", row_num: 2, name: "", email: "jane@example.com", phone: "555-1234", address: null, roles: "foster" },
      ],
      adoptions: [
        { id: "sd1", row_num: 1, staging_animal_id: "sa1", staging_contact_id: "sc1", date: "2024-01-01" },
        { id: "sd2", row_num: 2, staging_animal_id: "sa1", staging_contact_id: "sc2", date: "2025-06-01" },
      ],
    });

    const result = await promoteImport(db, "job1", "org1");

    expect(result.contacts).toBe(1); // one real contact, not two
    expect(result.contactsMerged).toBe(1);
    expect(out.contacts).toHaveLength(1);
    const merged = out.contacts[0];
    expect(merged.name).toBe("Jane Smith"); // filled in from the row missing it
    expect(merged.phone).toBe("555-1234"); // filled in from the row missing it
    expect(merged.address).toBe("1 Main St");
    expect(new Set(String(merged.roles).split(","))).toEqual(new Set(["adopter", "foster"]));

    // both adoption rows now point at the SAME real contact — history intact
    expect(out.adoptions).toHaveLength(2);
    expect(out.adoptions[0].contact_id).toBe(merged.id);
    expect(out.adoptions[1].contact_id).toBe(merged.id);
  });

  it("never merges different people, or people with no email at all", async () => {
    const { db, out } = fakeDb({
      animals: [],
      contacts: [
        { id: "sc1", row_num: 1, name: "Alice", email: "alice@example.com", phone: null, address: null, roles: "adopter" },
        { id: "sc2", row_num: 2, name: "Bob", email: "bob@example.com", phone: null, address: null, roles: "adopter" },
        { id: "sc3", row_num: 3, name: "No Email One", email: null, phone: null, address: null, roles: "donor" },
        { id: "sc4", row_num: 4, name: "No Email Two", email: "", phone: null, address: null, roles: "donor" },
      ],
    });

    const result = await promoteImport(db, "job1", "org1");

    expect(result.contacts).toBe(4); // nobody wrongly merged
    expect(result.contactsMerged).toBe(0);
    expect(out.contacts).toHaveLength(4);
  });
});
