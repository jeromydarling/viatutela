/**
 * Row-level normalization: raw CSV/XLSX row + confirmed mapping ->
 * a normalized record plus per-field issues. Shared by the live preview
 * and the background processor so what you preview is what you get.
 */

import {
  type FileKind,
  normalizeBoolean,
  normalizeDate,
  normalizeEmail,
  normalizeFee,
  normalizePhone,
  normalizeRoles,
  normalizeSex,
  normalizeSpecies,
  normalizeStatus,
  splitPhotoUrls,
} from "./normalize";

export interface RowIssue {
  field: string;
  reason: string;
}

export interface NormalizedRow {
  record: Record<string, unknown>;
  issues: RowIssue[];
  /** true when the row is usable (issues may still be warnings) */
  ok: boolean;
}

/** mapping: rawHeader -> canonical field (null = ignored) */
export function normalizeRow(
  kind: FileKind,
  headers: string[],
  raw: string[],
  mapping: Record<string, string | null>,
): NormalizedRow {
  const record: Record<string, unknown> = {};
  const issues: RowIssue[] = [];

  // collect raw values keyed by canonical field (photo_urls may repeat)
  const photoUrls: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    const canon = mapping[headers[i]];
    if (!canon) continue;
    const rawVal = (raw[i] ?? "").trim();
    if (!rawVal) continue;
    if (canon === "photo_urls") {
      photoUrls.push(...splitPhotoUrls(rawVal));
      continue;
    }
    record[canon] = rawVal;
  }
  if (photoUrls.length) record.photo_urls = photoUrls;

  const get = (f: string): string => (typeof record[f] === "string" ? (record[f] as string) : "");

  // contacts: build name from first/last when needed
  if (kind === "contacts") {
    if (!get("name")) {
      const joined = [get("first_name"), get("last_name")].filter(Boolean).join(" ").trim();
      if (joined) record.name = joined;
    }
    delete record.first_name;
    delete record.last_name;
  }

  // ---- typed normalizations with issue collection ----
  const normalizeDateField = (field: string, required = false) => {
    const v = get(field);
    if (!v) {
      if (required) issues.push({ field, reason: "missing date" });
      return;
    }
    const iso = normalizeDate(v);
    if (iso) record[field] = iso;
    else {
      issues.push({ field, reason: `unrecognized date "${v}"` });
      delete record[field];
    }
  };

  if (kind === "animals") {
    if (!get("name")) issues.push({ field: "name", reason: "missing animal name" });
    const sp = get("species");
    if (sp) {
      const norm = normalizeSpecies(sp);
      record.species = norm;
    }
    const sex = get("sex");
    if (sex) {
      const norm = normalizeSex(sex);
      if (norm) record.sex = norm;
      else {
        issues.push({ field: "sex", reason: `unrecognized sex "${sex}"` });
        delete record.sex;
      }
    }
    const alt = get("altered");
    if (alt) {
      const norm = normalizeBoolean(alt);
      if (norm === null) {
        issues.push({ field: "altered", reason: `unrecognized spay/neuter value "${alt}"` });
        delete record.altered;
      } else record.altered = norm ? 1 : 0;
    }
    const st = get("status");
    if (st) record.status = normalizeStatus(st);
    normalizeDateField("dob");
    normalizeDateField("intake_date");
    const chip = get("microchip");
    if (chip) {
      const digits = chip.replace(/[^0-9A-Za-z]/g, "");
      if (digits.length < 9 || digits.length > 15) {
        issues.push({ field: "microchip", reason: `microchip "${chip}" is not 9-15 characters` });
      }
      record.microchip = digits;
    }
  }

  if (kind === "contacts") {
    if (!get("name")) issues.push({ field: "name", reason: "missing contact name" });
    const email = get("email");
    if (email) {
      const { value, valid } = normalizeEmail(email);
      record.email = value;
      if (!valid) issues.push({ field: "email", reason: `invalid email "${email}"` });
    }
    const phone = get("phone");
    if (phone) record.phone = normalizePhone(phone);
    const roles = get("roles");
    if (roles) record.roles = normalizeRoles(roles);
  }

  if (kind === "medical") {
    if (!get("animal_ref")) issues.push({ field: "animal_ref", reason: "no animal reference — cannot attach record" });
    normalizeDateField("date");
    if (!get("type") && !get("description")) {
      issues.push({ field: "type", reason: "record has neither a type nor a description" });
    }
  }

  if (kind === "adoptions") {
    if (!get("animal_ref")) issues.push({ field: "animal_ref", reason: "no animal reference — cannot link adoption" });
    normalizeDateField("date");
    const fee = get("fee");
    if (fee) {
      const n = normalizeFee(fee);
      if (n === null) {
        issues.push({ field: "fee", reason: `unrecognized fee "${fee}"` });
        delete record.fee;
      } else record.fee = n;
    }
    const st = get("status");
    if (st) record.status = normalizeStatus(st);
    else record.status = "completed";
  }

  // A row is fatally flagged when it's missing its identity/link fields.
  const fatal = issues.some(
    (i) =>
      (i.field === "name" && (kind === "animals" || kind === "contacts")) ||
      i.field === "animal_ref",
  );

  return { record, issues, ok: !fatal };
}
