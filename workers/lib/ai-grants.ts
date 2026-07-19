/**
 * Grant-writer AI — drafts funder-ready narratives from the shelter's
 * REAL numbers (outcomes, volunteer hours, budget signals). Drafts are
 * saved for editing, never submitted anywhere.
 */

import { structured } from "./ai-shelter";

export interface GrantStats {
  org_name: string;
  city: string | null;
  about: string | null;
  in_care: number;
  intakes_12mo: number;
  adoptions_12mo: number;
  avg_days_to_adoption: number | null;
  active_fosters: number;
  volunteers: number;
  volunteer_hours_12mo: number;
  donations_12mo: number;
  donors_12mo: number;
}

export async function gatherGrantStats(env: Env, orgId: string): Promise<GrantStats> {
  const row = await env.DB.prepare(
    `SELECT
      (SELECT name FROM orgs WHERE id = ?1) org_name,
      (SELECT address FROM orgs WHERE id = ?1) address,
      (SELECT about FROM orgs WHERE id = ?1) about,
      (SELECT COUNT(*) FROM animals WHERE org_id = ?1 AND status IN ('available','in foster','pending')) in_care,
      (SELECT COUNT(*) FROM animals WHERE org_id = ?1 AND intake_date >= date('now','-12 months')) intakes_12mo,
      (SELECT COUNT(*) FROM adoptions WHERE org_id = ?1 AND date >= date('now','-12 months')) adoptions_12mo,
      (SELECT ROUND(AVG(julianday(ad.date) - julianday(a.intake_date)),1) FROM adoptions ad
        JOIN animals a ON a.id = ad.animal_id
        WHERE ad.org_id = ?1 AND a.intake_date IS NOT NULL AND ad.date IS NOT NULL
          AND julianday(ad.date) >= julianday(a.intake_date)) avg_days,
      (SELECT COUNT(*) FROM foster_assignments WHERE org_id = ?1 AND active = 1) active_fosters,
      (SELECT COUNT(*) FROM contacts WHERE org_id = ?1 AND roles LIKE '%volunteer%') volunteers,
      (SELECT COALESCE(SUM(hours),0) FROM shift_signups WHERE org_id = ?1 AND created_at >= datetime('now','-12 months')) vol_hours,
      (SELECT COALESCE(SUM(amount),0) FROM donations WHERE org_id = ?1 AND date >= date('now','-12 months')) donated,
      (SELECT COUNT(DISTINCT COALESCE(contact_id, donor_name)) FROM donations WHERE org_id = ?1 AND date >= date('now','-12 months')) donors`,
  )
    .bind(orgId)
    .first<Record<string, unknown>>();
  return {
    org_name: String(row?.org_name ?? "the rescue"),
    city: row?.address ? String(row.address).split(",").slice(-2).join(",").trim() : null,
    about: row?.about ? String(row.about) : null,
    in_care: Number(row?.in_care ?? 0),
    intakes_12mo: Number(row?.intakes_12mo ?? 0),
    adoptions_12mo: Number(row?.adoptions_12mo ?? 0),
    avg_days_to_adoption: row?.avg_days == null ? null : Number(row.avg_days),
    active_fosters: Number(row?.active_fosters ?? 0),
    volunteers: Number(row?.volunteers ?? 0),
    volunteer_hours_12mo: Number(row?.vol_hours ?? 0),
    donations_12mo: Number(row?.donated ?? 0),
    donors_12mo: Number(row?.donors ?? 0),
  };
}

export async function writeGrantDraft(
  env: Env,
  args: { orgId: string; stats: GrantStats; funder: string; amount: string; focus: string; notes: string },
): Promise<{ content?: string; error?: string }> {
  const schema = {
    type: "object",
    properties: { content: { type: "string" } },
    required: ["content"],
    additionalProperties: false,
  };
  const prompt = `Draft a grant application narrative for an animal shelter. Professional nonprofit grant-writing voice — specific, outcomes-first, warm but never saccharine, zero filler. Use ONLY the real statistics provided; where a number is 0 or missing, write around it honestly (e.g. "we are beginning to formally track volunteer hours") rather than inventing.

APPLICANT: ${JSON.stringify(args.stats)}
FUNDER: ${args.funder.slice(0, 200)}
AMOUNT REQUESTED: ${args.amount.slice(0, 50) || "not specified"}
PROGRAM / USE OF FUNDS: ${args.focus.slice(0, 500) || "general operating support"}
EXTRA CONTEXT FROM STAFF: ${args.notes.slice(0, 1000) || "none"}

Return markdown with these ## sections:
1. Organization Overview (who we are, community served)
2. Statement of Need (the local problem, grounded in our intake numbers)
3. Program Description (what the funds do, concrete activities)
4. Outcomes & Evaluation (past-12-month results as evidence; how we'll measure this grant)
5. Budget Narrative (how the requested amount breaks down — reasonable categories, clearly labeled as proposed)
6. Sustainability (donor base, volunteer engagement, fosters)
Keep it ~700-900 words. Include the actual numbers inline. Never fabricate partnerships, staff counts, or history not given.`;

  const res = await structured<{ content: string }>(env, prompt, schema, 4000, {
    orgId: args.orgId,
    feature: "grant_draft",
  });
  if (res.error || !res.data?.content) return { error: res.error ?? "No draft came back." };
  return { content: res.data.content.slice(0, 20000) };
}
