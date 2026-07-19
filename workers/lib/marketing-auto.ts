/**
 * Marketing that drafts itself — hooked to real shelter events, always
 * off the request path (callers use ctx.waitUntil), always idempotent
 * (events re-fire), never posting anywhere. When AI is unconfigured the
 * campaign SHELL is still created so it's one tap to generate later.
 */

import { newId } from "./ids";
import { getAnthropic } from "./ai";
import { parseBrandJson } from "./brand";
import { daysBetween } from "./ai-shelter";
import { generateChannelAsset, type CampaignContext } from "./marketing";

async function campaignExists(env: Env, orgId: string, animalId: string, source: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT id FROM marketing_campaigns WHERE org_id = ? AND animal_id = ? AND source = ? LIMIT 1`,
  )
    .bind(orgId, animalId, source)
    .first();
  return Boolean(row);
}

async function contextFor(
  env: Env,
  orgId: string,
  campaign: { id: string; name: string; objective: string; keyMessage: string | null; animalId: string | null },
): Promise<CampaignContext> {
  const org = await env.DB.prepare(
    `SELECT name, slug, address, custom_domain, brand_json FROM orgs WHERE id = ?`,
  )
    .bind(orgId)
    .first<{ name: string; slug: string; address: string | null; custom_domain: string | null; brand_json: string | null }>();
  const appOrigin = (env as unknown as { APP_ORIGIN?: string }).APP_ORIGIN ?? "https://viatutela.com";
  let animal: CampaignContext["animal"] = null;
  if (campaign.animalId) {
    const a = await env.DB.prepare(`SELECT name, species, breed, description, intake_date FROM animals WHERE id = ?`)
      .bind(campaign.animalId)
      .first<Record<string, unknown>>();
    if (a) {
      animal = {
        name: String(a.name),
        species: a.species ? String(a.species) : null,
        breed: a.breed ? String(a.breed) : null,
        description: a.description ? String(a.description).slice(0, 400) : null,
        days_in_care: daysBetween(a.intake_date as string | null, new Date().toISOString().slice(0, 10)),
      };
    }
  }
  return {
    orgId,
    orgName: org?.name ?? "the rescue",
    city: org?.address ? org.address.split(",").slice(-2).join(",").trim() : null,
    voice: parseBrandJson(org?.brand_json ?? null).voice,
    siteUrl: org?.custom_domain ? `https://${org.custom_domain}` : `${appOrigin}/s/${org?.slug}`,
    campaignName: campaign.name,
    objective: campaign.objective,
    keyMessage: campaign.keyMessage,
    animal,
  };
}

async function createCampaignWithDrafts(
  env: Env,
  orgId: string,
  args: { name: string; objective: string; animalId: string | null; keyMessage: string; source: string; channels: string[] },
): Promise<void> {
  const id = newId("mc");
  await env.DB.prepare(
    `INSERT INTO marketing_campaigns (id, org_id, name, objective, animal_id, key_message, source) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, orgId, args.name.slice(0, 120), args.objective, args.animalId, args.keyMessage.slice(0, 300), args.source)
    .run();

  // degrade cleanly: no AI key → the shell alone is the deliverable
  if (!getAnthropic(env)) return;

  const ctx = await contextFor(env, orgId, {
    id,
    name: args.name,
    objective: args.objective,
    keyMessage: args.keyMessage,
    animalId: args.animalId,
  });
  const results = await Promise.all(args.channels.map((ch) => generateChannelAsset(env, ctx, ch)));
  const stmts: D1PreparedStatement[] = [];
  for (const r of results) {
    if (!r.asset) continue;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO marketing_assets (id, org_id, campaign_id, channel, kind, title, content, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(newId("ma"), orgId, id, r.asset.channel, r.asset.kind, r.asset.title, r.asset.content, JSON.stringify(r.asset.meta)),
    );
  }
  if (stmts.length) await env.DB.batch(stmts);
}

/** New adoptable friend published → launch kit, once per animal ever. */
export async function autoNewAnimal(env: Env, orgId: string, animalId: string): Promise<void> {
  try {
    if (await campaignExists(env, orgId, animalId, "auto_new_animal")) return;
    const animal = await env.DB.prepare(
      `SELECT name, is_public, status FROM animals WHERE id = ? AND org_id = ?`,
    )
      .bind(animalId, orgId)
      .first<{ name: string; is_public: number; status: string }>();
    if (!animal || !animal.is_public || animal.status !== "available") return;
    await createCampaignWithDrafts(env, orgId, {
      name: `Meet ${animal.name}!`,
      objective: "adoption_push",
      animalId,
      keyMessage: `${animal.name} just arrived and is looking for a home.`,
      source: "auto_new_animal",
      channels: ["instagram", "facebook", "story"],
    });
  } catch (err) {
    console.log(`[auto new-animal campaign failed] ${err instanceof Error ? err.message : err}`);
  }
}

/** Adoption completed → success-story draft, once per animal ever. */
export async function autoAdoption(env: Env, orgId: string, animalId: string): Promise<void> {
  try {
    if (await campaignExists(env, orgId, animalId, "auto_adoption")) return;
    const animal = await env.DB.prepare(`SELECT name FROM animals WHERE id = ? AND org_id = ?`)
      .bind(animalId, orgId)
      .first<{ name: string }>();
    if (!animal) return;
    await createCampaignWithDrafts(env, orgId, {
      name: `${animal.name} found home 🏡`,
      objective: "success_story",
      animalId,
      keyMessage: `${animal.name} was just adopted — celebrate and thank the community.`,
      source: "auto_adoption",
      channels: ["facebook", "instagram"],
    });
  } catch (err) {
    console.log(`[auto adoption campaign failed] ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Weekly (from cron): "still looking" spotlights for friends waiting
 * 60+ days. Guard: skip while ANY unposted auto_long_stay draft exists
 * for that animal — it must never nag. Cap 2 new spotlights per org/run.
 */
export async function autoLongStaySpotlights(env: Env): Promise<void> {
  try {
    const candidates = await env.DB.prepare(
      `SELECT a.org_id, a.id, a.name FROM animals a
       WHERE a.is_public = 1 AND a.status = 'available'
         AND a.intake_date IS NOT NULL AND a.intake_date <= date('now', '-60 days')
         AND NOT EXISTS (
           SELECT 1 FROM marketing_campaigns mc
           JOIN marketing_assets ma ON ma.campaign_id = mc.id AND ma.posted_at IS NULL
           WHERE mc.org_id = a.org_id AND mc.animal_id = a.id AND mc.source = 'auto_long_stay'
         )
         AND NOT EXISTS (
           SELECT 1 FROM marketing_campaigns mc2
           WHERE mc2.org_id = a.org_id AND mc2.animal_id = a.id AND mc2.source = 'auto_long_stay'
             AND mc2.created_at >= datetime('now', '-30 days')
         )
       ORDER BY a.intake_date LIMIT 40`,
    ).all<{ org_id: string; id: string; name: string }>();

    const perOrg = new Map<string, number>();
    for (const c of candidates.results) {
      const n = perOrg.get(c.org_id) ?? 0;
      if (n >= 2) continue;
      perOrg.set(c.org_id, n + 1);
      await createCampaignWithDrafts(env, c.org_id, {
        name: `${c.name} is still looking 💛`,
        objective: "adoption_push",
        animalId: c.id,
        keyMessage: `${c.name} has waited a long time — a fresh spotlight could change everything.`,
        source: "auto_long_stay",
        channels: ["facebook", "story"],
      });
    }
  } catch (err) {
    console.log(`[auto long-stay spotlights failed] ${err instanceof Error ? err.message : err}`);
  }
}
