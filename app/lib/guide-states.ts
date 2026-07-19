/**
 * State-by-state "start a rescue" pages — programmatic SEO done honestly.
 * Every page combines the universal checklist with real regional rescue
 * context and state-specific notes we're confident in; anything uncertain
 * is framed as "verify with this agency", never invented. Rules change —
 * every page says so.
 */

export type Region = "Northeast" | "South" | "Midwest" | "Mountain West" | "West Coast" | "Southwest";

export interface RescueState {
  slug: string;
  name: string;
  abbr: string;
  region: Region;
  /** The corporations office nonprofits file with (best-known name). */
  corp: string;
  /** State-level licensing/registration note — only where we're confident. */
  licensing: string | null;
}

export const REGION_NOTES: Record<Region, { context: string; practical: string }> = {
  South: {
    context:
      "The South is the great source region of American rescue: intake pressure runs high, spay/neuter access runs thin, and transport partnerships with Northeastern and upper-Midwest rescues move thousands of animals a year to where adopters are waiting.",
    practical:
      "Budget seriously for heartworm — prevention for every dog in care and treatment reserves for positives, because they will come. Parvo protocols and warm-season intake surges (kitten season barely pauses in the Gulf states) belong in your planning from day one. If you transport north, learn your receiving states' import rules early — health certificates and quarantine requirements are the transporter's responsibility to get right.",
  },
  Northeast: {
    context:
      "The Northeast is rescue's biggest destination market: adopter demand routinely outruns local intake, which is why so many Northeastern rescues run transport programs bringing animals up from the South.",
    practical:
      "If you'll receive out-of-state animals, your state's importation rules are the first thing to master — most Northeastern states require rescues that import to register with the state and follow health-certificate and quarantine protocols. Build vet capacity for arrival exams, and expect your adopter pipeline to move fast once you're known.",
  },
  Midwest: {
    context:
      "The Midwest mixes both worlds: strong adopter demand in the metros, real intake pressure in rural counties, and — in some states — proximity to concentrated commercial breeding operations, which shapes the dogs that come into rescue.",
    practical:
      "Winter changes fieldwork: cold-weather holds, barn-cat programs, and heated transport all matter here. Rural pulls often mean long drives — a volunteer transport chain multiplies your range. Ex-breeding dogs need patient, experienced fosters; recruit for that speciality explicitly.",
  },
  "Mountain West": {
    context:
      "Mountain West rescue is defined by distance: enormous service areas, thin veterinary coverage outside the metros, and strong partnership networks — including, in several states, longstanding collaborations with tribal communities on reservation animal programs.",
    practical:
      "Map your vet access honestly before committing to a service area — the nearest emergency clinic may be two hours away. Transport hubs (Denver, Salt Lake, Boise) anchor regional networks worth joining early. Altitude and winter road closures are real operational constraints; plan intake and transport around them.",
  },
  "West Coast": {
    context:
      "West Coast rescue runs on an internal gradient: coastal metros with intense adopter demand pulling from high-intake inland and rural areas — California's Central Valley alone supplies rescues up and down the coast.",
    practical:
      "Urban adopters expect polished listings, fast responses, and online everything — your web presence is your front door. Housing costs squeeze fosters, so a smaller, well-supported foster network beats a large, burned-out one. Wildfire season needs an evacuation plan for every animal in care, written before you need it.",
  },
  Southwest: {
    context:
      "The Southwest combines high intake, fast-growing metros, and desert realities. Border-region rescue adds cross-community partnerships, and several states' rescue networks work closely with tribal animal programs.",
    practical:
      "Heat is an operational constraint, not a footnote: summer transport happens at dawn, outdoor events go seasonal, and vehicle protocols save lives. Parvo pressure is persistent — vaccinate on intake, always. Monsoon and extreme-heat days need indoor fallback plans for every scheduled event.",
  },
};

// Licensing notes: stated only where confidence is high; all pages carry a
// verify-with-the-agency instruction regardless.
export const STATES: RescueState[] = [
  { slug: "alabama", name: "Alabama", abbr: "AL", region: "South", corp: "Alabama Secretary of State", licensing: null },
  { slug: "alaska", name: "Alaska", abbr: "AK", region: "Mountain West", corp: "Alaska Division of Corporations", licensing: null },
  { slug: "arizona", name: "Arizona", abbr: "AZ", region: "Southwest", corp: "Arizona Corporation Commission", licensing: null },
  { slug: "arkansas", name: "Arkansas", abbr: "AR", region: "South", corp: "Arkansas Secretary of State", licensing: null },
  { slug: "california", name: "California", abbr: "CA", region: "West Coast", corp: "California Secretary of State", licensing: "California has no statewide rescue license, but cities and counties commonly require kennel or animal-facility permits — check both your city and county before housing animals." },
  { slug: "colorado", name: "Colorado", abbr: "CO", region: "Mountain West", corp: "Colorado Secretary of State", licensing: "Colorado licenses rescues and shelters under PACFA (the Pet Animal Care Facilities Act) through the Department of Agriculture — you'll need a PACFA license before operating." },
  { slug: "connecticut", name: "Connecticut", abbr: "CT", region: "Northeast", corp: "Connecticut Secretary of the State", licensing: "Connecticut requires rescues importing animals into the state to register with the Department of Agriculture and follow its import and veterinary-check rules." },
  { slug: "delaware", name: "Delaware", abbr: "DE", region: "Northeast", corp: "Delaware Division of Corporations", licensing: null },
  { slug: "florida", name: "Florida", abbr: "FL", region: "South", corp: "Florida Division of Corporations (Sunbiz)", licensing: "Florida has no statewide rescue license; county animal-control ordinances govern, and several large counties have their own rescue registration programs." },
  { slug: "georgia", name: "Georgia", abbr: "GA", region: "South", corp: "Georgia Secretary of State", licensing: "Georgia licenses animal shelters and rescues through the Department of Agriculture under the Animal Protection Act — apply before taking animals into care." },
  { slug: "hawaii", name: "Hawaii", abbr: "HI", region: "West Coast", corp: "Hawaii DCCA Business Registration", licensing: "Hawaii's rabies-free status means strict quarantine and import rules — any inter-island or mainland transfer program must be built around them." },
  { slug: "idaho", name: "Idaho", abbr: "ID", region: "Mountain West", corp: "Idaho Secretary of State", licensing: null },
  { slug: "illinois", name: "Illinois", abbr: "IL", region: "Midwest", corp: "Illinois Secretary of State", licensing: "Illinois licenses shelters and rescues under the Animal Welfare Act through the Department of Agriculture — a license is required before operating." },
  { slug: "indiana", name: "Indiana", abbr: "IN", region: "Midwest", corp: "Indiana Secretary of State", licensing: null },
  { slug: "iowa", name: "Iowa", abbr: "IA", region: "Midwest", corp: "Iowa Secretary of State", licensing: "Iowa requires animal shelters and rescues to obtain a state license or registration through the Department of Agriculture and Land Stewardship." },
  { slug: "kansas", name: "Kansas", abbr: "KS", region: "Midwest", corp: "Kansas Secretary of State", licensing: "Kansas licenses animal shelters and rescue networks under the Kansas Pet Animal Act — check the Department of Agriculture's animal facilities program." },
  { slug: "kentucky", name: "Kentucky", abbr: "KY", region: "South", corp: "Kentucky Secretary of State", licensing: null },
  { slug: "louisiana", name: "Louisiana", abbr: "LA", region: "South", corp: "Louisiana Secretary of State", licensing: null },
  { slug: "maine", name: "Maine", abbr: "ME", region: "Northeast", corp: "Maine Secretary of State", licensing: "Maine licenses animal shelters and rescues through its Animal Welfare Program, and imported animals must follow state health-certificate rules." },
  { slug: "maryland", name: "Maryland", abbr: "MD", region: "Northeast", corp: "Maryland SDAT", licensing: null },
  { slug: "massachusetts", name: "Massachusetts", abbr: "MA", region: "Northeast", corp: "Massachusetts Secretary of the Commonwealth", licensing: "Massachusetts requires rescues importing animals to register with MDAR (the Department of Agricultural Resources) and follow its isolation and health-check protocols." },
  { slug: "michigan", name: "Michigan", abbr: "MI", region: "Midwest", corp: "Michigan LARA", licensing: "Michigan registers animal shelters and large-scale rescues with MDARD (the Department of Agriculture and Rural Development)." },
  { slug: "minnesota", name: "Minnesota", abbr: "MN", region: "Midwest", corp: "Minnesota Secretary of State", licensing: null },
  { slug: "mississippi", name: "Mississippi", abbr: "MS", region: "South", corp: "Mississippi Secretary of State", licensing: null },
  { slug: "missouri", name: "Missouri", abbr: "MO", region: "Midwest", corp: "Missouri Secretary of State", licensing: "Missouri licenses shelters and rescues under the Animal Care Facilities Act (ACFA) through the Department of Agriculture — required before operating." },
  { slug: "montana", name: "Montana", abbr: "MT", region: "Mountain West", corp: "Montana Secretary of State", licensing: null },
  { slug: "nebraska", name: "Nebraska", abbr: "NE", region: "Midwest", corp: "Nebraska Secretary of State", licensing: "Nebraska requires animal shelters and rescues to be licensed under the Commercial Dog and Cat Operator Inspection Act via the Department of Agriculture." },
  { slug: "nevada", name: "Nevada", abbr: "NV", region: "Southwest", corp: "Nevada Secretary of State", licensing: null },
  { slug: "new-hampshire", name: "New Hampshire", abbr: "NH", region: "Northeast", corp: "New Hampshire Secretary of State", licensing: "New Hampshire requires a license for animal shelters and has specific transfer/import rules through the Department of Agriculture." },
  { slug: "new-jersey", name: "New Jersey", abbr: "NJ", region: "Northeast", corp: "New Jersey Division of Revenue", licensing: "New Jersey animal facilities are licensed at the municipal level under state health codes — start with your municipality and the Department of Health." },
  { slug: "new-mexico", name: "New Mexico", abbr: "NM", region: "Southwest", corp: "New Mexico Secretary of State", licensing: null },
  { slug: "new-york", name: "New York", abbr: "NY", region: "Northeast", corp: "New York Department of State", licensing: "New York requires rescues and shelters to register with the Department of Agriculture and Markets." },
  { slug: "north-carolina", name: "North Carolina", abbr: "NC", region: "South", corp: "North Carolina Secretary of State", licensing: "North Carolina registers animal shelters through the Department of Agriculture's Animal Welfare Section." },
  { slug: "north-dakota", name: "North Dakota", abbr: "ND", region: "Midwest", corp: "North Dakota Secretary of State", licensing: null },
  { slug: "ohio", name: "Ohio", abbr: "OH", region: "Midwest", corp: "Ohio Secretary of State", licensing: null },
  { slug: "oklahoma", name: "Oklahoma", abbr: "OK", region: "South", corp: "Oklahoma Secretary of State", licensing: null },
  { slug: "oregon", name: "Oregon", abbr: "OR", region: "West Coast", corp: "Oregon Secretary of State", licensing: null },
  { slug: "pennsylvania", name: "Pennsylvania", abbr: "PA", region: "Northeast", corp: "Pennsylvania Department of State", licensing: "Pennsylvania requires a kennel license (via the Department of Agriculture's Bureau of Dog Law Enforcement) once you house or transfer more than a threshold number of dogs per year — most active rescues cross it." },
  { slug: "rhode-island", name: "Rhode Island", abbr: "RI", region: "Northeast", corp: "Rhode Island Department of State", licensing: "Rhode Island regulates animal imports and rescue registration through DEM (the Department of Environmental Management)." },
  { slug: "south-carolina", name: "South Carolina", abbr: "SC", region: "South", corp: "South Carolina Secretary of State", licensing: null },
  { slug: "south-dakota", name: "South Dakota", abbr: "SD", region: "Midwest", corp: "South Dakota Secretary of State", licensing: null },
  { slug: "tennessee", name: "Tennessee", abbr: "TN", region: "South", corp: "Tennessee Secretary of State", licensing: null },
  { slug: "texas", name: "Texas", abbr: "TX", region: "South", corp: "Texas Secretary of State", licensing: "Texas has no statewide rescue license — regulation happens at the city and county level, so check local animal-control ordinances everywhere you'll operate." },
  { slug: "utah", name: "Utah", abbr: "UT", region: "Mountain West", corp: "Utah Division of Corporations", licensing: null },
  { slug: "vermont", name: "Vermont", abbr: "VT", region: "Northeast", corp: "Vermont Secretary of State", licensing: null },
  { slug: "virginia", name: "Virginia", abbr: "VA", region: "South", corp: "Virginia State Corporation Commission", licensing: "Virginia requires releasing agencies (including rescues) to register and report annually to the Office of the State Veterinarian." },
  { slug: "washington", name: "Washington", abbr: "WA", region: "West Coast", corp: "Washington Secretary of State", licensing: null },
  { slug: "west-virginia", name: "West Virginia", abbr: "WV", region: "South", corp: "West Virginia Secretary of State", licensing: null },
  { slug: "wisconsin", name: "Wisconsin", abbr: "WI", region: "Midwest", corp: "Wisconsin Department of Financial Institutions", licensing: "Wisconsin licenses animal shelters and rescues through DATCP (the Department of Agriculture, Trade and Consumer Protection) once they exceed a small annual transfer threshold." },
  { slug: "wyoming", name: "Wyoming", abbr: "WY", region: "Mountain West", corp: "Wyoming Secretary of State", licensing: null },
];

export function getState(slug: string): RescueState | undefined {
  return STATES.find((s) => s.slug === slug);
}

export function nearbyStates(state: RescueState, n = 5): RescueState[] {
  return STATES.filter((s) => s.region === state.region && s.slug !== state.slug).slice(0, n);
}
