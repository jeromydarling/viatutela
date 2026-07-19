/**
 * Public adoption-page filtering — pure functions shared by the portal
 * UI (client-side, instant) and tests. Filters only APPEAR when a
 * shelter has enough friends for browsing to need help; a handful of
 * animals stays a simple warm list.
 */

/** Below this many animals, the portal hides the filter bar entirely. */
export const FILTERS_APPEAR_AT = 9;

export interface FilterableAnimal {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  dob: string | null;
  description: string | null;
  bonded_group_id: string | null;
}

export interface AnimalFilterState {
  q: string;
  species: string; // "" = all
  age: "" | "young" | "adult" | "senior";
  sex: "" | "male" | "female";
  bonded: boolean;
}

export const EMPTY_FILTER: AnimalFilterState = { q: "", species: "", age: "", sex: "", bonded: false };

export function ageGroup(dob: string | null | undefined, now = Date.now()): "young" | "adult" | "senior" | null {
  if (!dob) return null;
  const t = Date.parse(dob);
  if (Number.isNaN(t)) return null;
  const years = (now - t) / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return null;
  if (years < 1) return "young";
  if (years >= 7) return "senior";
  return "adult";
}

export function filterAnimals<T extends FilterableAnimal>(
  animals: T[],
  f: AnimalFilterState,
  now = Date.now(),
): T[] {
  const q = f.q.trim().toLowerCase();
  return animals.filter((a) => {
    if (f.species && (a.species ?? "").toLowerCase() !== f.species.toLowerCase()) return false;
    if (f.sex && (a.sex ?? "").toLowerCase() !== f.sex) return false;
    if (f.age && ageGroup(a.dob, now) !== f.age) return false;
    if (f.bonded && !a.bonded_group_id) return false;
    if (q) {
      const hay = [a.name, a.species, a.breed, a.description].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Distinct species present, for building filter chips from real data. */
export function speciesPresent(animals: FilterableAnimal[]): string[] {
  const seen = new Map<string, number>();
  for (const a of animals) {
    const sp = (a.species ?? "").trim().toLowerCase();
    if (sp) seen.set(sp, (seen.get(sp) ?? 0) + 1);
  }
  return [...seen.entries()].sort((x, y) => y[1] - x[1]).map(([sp]) => sp);
}
