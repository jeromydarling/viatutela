/**
 * Normalization dictionaries and value parsers for the free importer.
 * Seeded from the spec; extend freely.
 */

// ---------- Canonical fields per file kind ----------

export type FileKind = "animals" | "contacts" | "medical" | "adoptions";

export const CANONICAL_FIELDS: Record<FileKind, string[]> = {
  animals: [
    "source_key",
    "name",
    "species",
    "breed",
    "sex",
    "dob",
    "altered",
    "microchip",
    "status",
    "description",
    "bonded_with",
    "intake_date",
    "photo_urls",
  ],
  contacts: ["source_key", "name", "first_name", "last_name", "email", "phone", "address", "roles"],
  medical: ["source_key", "animal_ref", "date", "type", "description", "vet"],
  adoptions: ["source_key", "animal_ref", "contact_ref", "date", "fee", "status"],
};

// ---------- Header alias dictionary ----------

/** alias (lowercased, squashed) -> canonical field, per kind */
const HEADER_ALIASES: Record<FileKind, Record<string, string>> = {
  animals: {
    id: "source_key", animalid: "source_key", petid: "source_key", "animal#": "source_key",
    animalnumber: "source_key", recordid: "source_key", uniqueid: "source_key",
    name: "name", animalname: "name", petname: "name",
    species: "species", type: "species", animaltype: "species", kind: "species",
    breed: "breed", primarybreed: "breed", breedmix: "breed",
    sex: "sex", gender: "sex",
    dob: "dob", dateofbirth: "dob", birthday: "dob", born: "dob", birthdate: "dob", age: "dob",
    altered: "altered", fixed: "altered", spayedneutered: "altered", spayneuter: "altered",
    sn: "altered", sterilized: "altered", desexed: "altered",
    microchip: "microchip", chip: "microchip", microchipnumber: "microchip", chipid: "microchip",
    "microchip#": "microchip", "chip#": "microchip", chipnumber: "microchip",
    status: "status", adoptionstatus: "status", state: "status", outcome: "status",
    description: "description", bio: "description", notes: "description", about: "description",
    memo: "description",
    bondedwith: "bonded_with", bondedpair: "bonded_with", bondedto: "bonded_with",
    bonded: "bonded_with", pairedwith: "bonded_with",
    intakedate: "intake_date", intake: "intake_date", datein: "intake_date",
    arrivaldate: "intake_date", admitted: "intake_date",
    photo: "photo_urls", photos: "photo_urls", photourl: "photo_urls", photourls: "photo_urls",
    image: "photo_urls", images: "photo_urls", imageurl: "photo_urls", picture: "photo_urls",
    pictures: "photo_urls", pic: "photo_urls",
  },
  contacts: {
    id: "source_key", contactid: "source_key", personid: "source_key", adopterid: "source_key",
    recordid: "source_key",
    name: "name", fullname: "name", contactname: "name", person: "name",
    firstname: "first_name", first: "first_name", fname: "first_name",
    lastname: "last_name", last: "last_name", lname: "last_name", surname: "last_name",
    email: "email", emailaddress: "email", mail: "email",
    phone: "phone", phonenumber: "phone", telephone: "phone", cell: "phone", mobile: "phone",
    address: "address", street: "address", homeaddress: "address", mailingaddress: "address",
    roles: "roles", role: "roles", contacttype: "roles", type: "roles", category: "roles",
  },
  medical: {
    id: "source_key", recordid: "source_key", medicalid: "source_key",
    animalid: "animal_ref", animal: "animal_ref", petid: "animal_ref", animalname: "animal_ref",
    pet: "animal_ref", patient: "animal_ref", "animal#": "animal_ref",
    date: "date", recorddate: "date", visitdate: "date", dateadministered: "date", given: "date",
    type: "type", recordtype: "type", procedure: "type", category: "type", treatment: "type",
    vaccine: "type",
    description: "description", details: "description", notes: "description", memo: "description",
    result: "description",
    vet: "vet", veterinarian: "vet", clinic: "vet", doctor: "vet", administeredby: "vet",
  },
  adoptions: {
    id: "source_key", adoptionid: "source_key", recordid: "source_key",
    animalid: "animal_ref", animal: "animal_ref", petid: "animal_ref", animalname: "animal_ref",
    pet: "animal_ref", "animal#": "animal_ref",
    adopterid: "contact_ref", adopter: "contact_ref", contactid: "contact_ref",
    adoptername: "contact_ref", person: "contact_ref", newowner: "contact_ref",
    contact: "contact_ref",
    date: "date", adoptiondate: "date", outcomedate: "date", dateadopted: "date",
    fee: "fee", adoptionfee: "fee", amount: "fee", price: "fee", donation: "fee",
    status: "status", adoptionstatus: "status", outcome: "status",
  },
};

function squash(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9#]/g, "");
}

/** Suggest a canonical mapping for a set of raw headers. Unmatched -> null. */
export function suggestMapping(
  headers: string[],
  kind: FileKind,
): Record<string, string | null> {
  const aliases = HEADER_ALIASES[kind];
  const mapping: Record<string, string | null> = {};
  const used = new Set<string>();
  for (const h of headers) {
    const canon = aliases[squash(h)] ?? null;
    if (canon && !used.has(canon)) {
      mapping[h] = canon;
      if (canon !== "photo_urls") used.add(canon);
    } else {
      mapping[h] = null;
    }
  }
  return mapping;
}

/** Guess which kind of file this is from its headers (and filename). */
export function guessFileKind(headers: string[], filename: string): FileKind {
  const fn = filename.toLowerCase();
  if (/(contact|adopter|people|person|donor|foster(?!.*animal))/.test(fn)) return "contacts";
  if (/(medical|vacc|health|vet)/.test(fn)) return "medical";
  if (/(adoption|outcome)/.test(fn)) return "adoptions";
  if (/(animal|pet|dog|cat|intake)/.test(fn)) return "animals";

  const scores: Record<FileKind, number> = { animals: 0, contacts: 0, medical: 0, adoptions: 0 };
  for (const kind of Object.keys(scores) as FileKind[]) {
    const m = suggestMapping(headers, kind);
    scores[kind] = Object.values(m).filter(Boolean).length;
  }
  // tie-break: prefer animals, then contacts
  const order: FileKind[] = ["animals", "contacts", "medical", "adoptions"];
  let best: FileKind = "animals";
  for (const k of order) if (scores[k] > scores[best]) best = k;

  // strong signals beat scores
  const squashed = headers.map(squash);
  if (squashed.some((h) => ["email", "emailaddress", "phone", "phonenumber"].includes(h)) &&
      !squashed.some((h) => ["species", "breed", "microchip", "animaltype"].includes(h))) {
    return "contacts";
  }
  if (squashed.some((h) => ["vaccine", "veterinarian", "vet"].includes(h))) return "medical";
  if (squashed.some((h) => ["adoptionfee", "adoptiondate", "adopter", "adopterid"].includes(h))) return "adoptions";
  return best;
}

// ---------- Value normalizers ----------

const SPECIES: Record<string, string> = {
  dog: "dog", k9: "dog", canine: "dog", pupper: "dog", doggo: "dog", puppy: "dog", pup: "dog",
  hound: "dog", "dog(canine)": "dog",
  cat: "cat", feline: "cat", kitty: "cat", kitten: "cat", "cat(feline)": "cat",
  rabbit: "rabbit", bunny: "rabbit",
  bird: "bird", avian: "bird",
  guineapig: "guinea pig", horse: "horse", equine: "horse",
  reptile: "reptile", hamster: "hamster", ferret: "ferret",
};

export function normalizeSpecies(v: string): string | null {
  const k = v.toLowerCase().replace(/[^a-z0-9()]/g, "");
  if (!k) return null;
  return SPECIES[k] ?? v.trim().toLowerCase();
}

export function normalizeSex(v: string): string | null {
  const k = v.trim().toLowerCase();
  if (!k) return null;
  if (["m", "male", "boy", "m/n", "neuteredmale", "neutered male"].includes(k)) return "male";
  if (["f", "female", "girl", "f/s", "spayedfemale", "spayed female"].includes(k)) return "female";
  if (["u", "unknown", "?"].includes(k)) return "unknown";
  return null; // unparseable -> flag
}

export function normalizeBoolean(v: string): boolean | null {
  const k = v.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!k) return null;
  if (["true", "yes", "y", "1", "t", "fixed", "spayed", "neutered", "altered", "sn", "sterilized", "desexed"].includes(k)) return true;
  if (["false", "no", "n", "0", "f", "intact", "unaltered", "notfixed"].includes(k)) return false;
  return null;
}

const STATUS: Record<string, string> = {
  available: "available", adoptable: "available", upforadoption: "available",
  availableforadoption: "available", open: "available",
  adopted: "adopted", rehomed: "adopted", homed: "adopted", adoptioncomplete: "adopted",
  pending: "pending", adoptionpending: "pending", onhold: "pending", hold: "pending",
  foster: "in foster", infoster: "in foster", fostered: "in foster", fostercare: "in foster",
  medical: "medical hold", medicalhold: "medical hold",
  transferred: "transferred", transfer: "transferred",
  deceased: "deceased", died: "deceased", euthanized: "deceased",
  returned: "returned", rto: "returned to owner", returnedtoowner: "returned to owner",
};

export function normalizeStatus(v: string): string | null {
  const k = v.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return null;
  return STATUS[k] ?? v.trim().toLowerCase();
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validYmd(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Accepts MM/DD/YYYY, M/D/YY, YYYY-MM-DD, "Jan 3 2021" / "January 3, 2021",
 * DD-Mon-YYYY, and Excel serial numbers. Returns ISO YYYY-MM-DD or null.
 */
export function normalizeDate(v: string | number): string | null {
  if (typeof v === "number") return excelSerialToIso(v);
  const s = v.trim();
  if (!s) return null;

  // Excel serial as string
  if (/^\d{4,6}(\.\d+)?$/.test(s) && !/^\d{4}$/.test(s)) {
    const iso = excelSerialToIso(Number(s));
    if (iso) return iso;
  }

  // YYYY-MM-DD / YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // MM/DD/YYYY or M/D/YY (US)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += y > 40 ? 1900 : 2000;
    const [mo, d] = [+m[1], +m[2]];
    return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // "Jan 3 2021", "January 3, 2021", "3 Jan 2021", "03-Jan-2021"
  m = s.match(/^([a-zA-Z]{3,9})[ .]+(\d{1,2})(?:st|nd|rd|th)?,?[ ]+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) {
      const [d, y] = [+m[2], +m[3]];
      return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
  }
  m = s.match(/^(\d{1,2})[ -]([a-zA-Z]{3,9})[ -,]+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) {
      const [d, y] = [+m[1], +m[3]];
      return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
  }
  return null;
}

/** Excel serial date (1900 epoch, incl. the leap-year bug offset). */
export function excelSerialToIso(serial: number): string | null {
  if (!isFinite(serial) || serial < 60 || serial > 80000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 2100) return null;
  return `${y}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function normalizeFee(v: string): number | null {
  const s = v.replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

export function normalizePhone(v: string): string | null {
  const digits = v.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1")
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return v.trim() || null;
}

export function normalizeEmail(v: string): { value: string | null; valid: boolean } {
  const s = v.trim().toLowerCase();
  if (!s) return { value: null, valid: true };
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  return { value: s, valid };
}

const ROLES: Record<string, string> = {
  adopter: "adopter", adopters: "adopter", adoptedfrom: "adopter",
  foster: "foster", fosters: "foster", fosterparent: "foster", fosterhome: "foster",
  volunteer: "volunteer", volunteers: "volunteer",
  donor: "donor", donors: "donor", supporter: "donor",
  staff: "staff", vet: "vet", veterinarian: "vet",
};

export function normalizeRoles(v: string): string | null {
  const parts = v.split(/[,;/|]/).map((p) => p.trim().toLowerCase().replace(/[^a-z]/g, "")).filter(Boolean);
  if (!parts.length) return null;
  const out = parts.map((p) => ROLES[p] ?? p);
  return [...new Set(out)].join(",");
}

/** Split a photo cell into URLs. */
export function splitPhotoUrls(v: string): string[] {
  return v
    .split(/[,;|\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}
