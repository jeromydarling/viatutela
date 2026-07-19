import { aiAvailable } from "../../../workers/lib/ai-shelter";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/marketing.campaign";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { getAnthropic, logAiWrite } from "../../../workers/lib/ai";
import { parseBrandJson } from "../../../workers/lib/brand";
import { CHANNELS, generateChannelAsset, type CampaignContext } from "../../../workers/lib/marketing";
import { sendSupporterEmail } from "../../../workers/lib/supporter-email";
import { daysBetween } from "../../../workers/lib/ai-shelter";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.campaign?.name ?? "Campaign"} — Marketing — Via Tutela` }];
}

async function loadCampaign(env: Env, orgId: string, campaignId: string) {
  const campaign = await env.DB.prepare(
    `SELECT mc.*, a.name animal_name FROM marketing_campaigns mc
     LEFT JOIN animals a ON a.id = mc.animal_id WHERE mc.id = ? AND mc.org_id = ?`,
  )
    .bind(campaignId, orgId)
    .first<Record<string, unknown>>();
  if (!campaign) throw new Response("Not found", { status: 404 });
  return campaign;
}

async function buildContext(env: Env, orgId: string, campaign: Record<string, unknown>): Promise<CampaignContext> {
  const org = await env.DB.prepare(
    `SELECT name, slug, address, custom_domain, brand_json FROM orgs WHERE id = ?`,
  )
    .bind(orgId)
    .first<{ name: string; slug: string; address: string | null; custom_domain: string | null; brand_json: string | null }>();
  const appOrigin = (env as unknown as { APP_ORIGIN?: string }).APP_ORIGIN ?? "https://viatutela.app";
  const siteUrl = org?.custom_domain ? `https://${org.custom_domain}` : `${appOrigin}/s/${org?.slug}`;
  let animal: CampaignContext["animal"] = null;
  if (campaign.animal_id) {
    const a = await env.DB.prepare(`SELECT name, species, breed, description, intake_date FROM animals WHERE id = ?`)
      .bind(campaign.animal_id)
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
    siteUrl,
    campaignName: String(campaign.name),
    objective: String(campaign.objective),
    keyMessage: campaign.key_message ? String(campaign.key_message) : null,
    animal,
  };
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const campaign = await loadCampaign(env, user.org_id, params.campaignId);
  const assets = await env.DB.prepare(
    `SELECT * FROM marketing_assets WHERE campaign_id = ? ORDER BY created_at`,
  )
    .bind(params.campaignId)
    .all<Record<string, unknown>>();
  return { campaign, assets: assets.results, aiReady: aiAvailable(env) };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const { env, ctx, user } = await requireUser(context, request);
  const campaign = await loadCampaign(env, user.org_id, params.campaignId);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const str = (k: string) => String(f.get(k) ?? "").trim();

  if (intent === "generate") {
    const selected = CHANNELS.filter((c) => f.get(`ch_${c.channel}`)).map((c) => c.channel);
    if (selected.length === 0) return { error: "Pick at least one channel." };
    const cctx = await buildContext(env, user.org_id, campaign);
    const results = await Promise.all(selected.map((ch) => generateChannelAsset(env, cctx, ch)));
    const stmts: D1PreparedStatement[] = [];
    let made = 0;
    const errors: string[] = [];
    results.forEach((r, i) => {
      if (r.asset) {
        made++;
        stmts.push(
          env.DB.prepare(
            `INSERT INTO marketing_assets (id, org_id, campaign_id, channel, kind, title, content, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(newId("ma"), user.org_id, campaign.id, r.asset.channel, r.asset.kind, r.asset.title, r.asset.content, JSON.stringify(r.asset.meta)),
        );
      } else if (r.error) {
        errors.push(`${selected[i]}: ${r.error}`);
      }
    });
    if (stmts.length) await env.DB.batch(stmts);
    await logAiWrite(env, user.org_id, user.user_id, "channel_kit", `campaign ${campaign.id}: ${made}/${selected.length} drafts`);
    if (made === 0) return { error: errors[0] ?? "Nothing came back — try again." };
    return { ok: `${made} draft${made === 1 ? "" : "s"} ready below.${errors.length ? ` (${errors.length} channel${errors.length === 1 ? "" : "s"} hit a snag.)` : ""}` };
  }

  if (intent === "update-asset") {
    await env.DB.prepare(
      `UPDATE marketing_assets SET title = ?, content = ?, scheduled_for = ? WHERE id = ? AND org_id = ?`,
    )
      .bind(str("title").slice(0, 200) || null, str("content").slice(0, 8000), str("scheduled_for") || null, str("asset_id"), user.org_id)
      .run();
    return { ok: "Draft saved." };
  }

  if (intent === "toggle-posted") {
    const asset = await env.DB.prepare(`SELECT posted_at FROM marketing_assets WHERE id = ? AND org_id = ?`)
      .bind(str("asset_id"), user.org_id)
      .first<{ posted_at: string | null }>();
    await env.DB.prepare(`UPDATE marketing_assets SET posted_at = ? WHERE id = ? AND org_id = ?`)
      .bind(asset?.posted_at ? null : new Date().toISOString(), str("asset_id"), user.org_id)
      .run();
    return { ok: asset?.posted_at ? "Marked as not posted." : "Marked posted — nice work. 🎉" };
  }

  if (intent === "delete-asset") {
    await env.DB.prepare(`DELETE FROM marketing_assets WHERE id = ? AND org_id = ?`)
      .bind(str("asset_id"), user.org_id)
      .run();
    return { ok: "Draft removed." };
  }

  if (intent === "send-email") {
    const asset = await env.DB.prepare(
      `SELECT * FROM marketing_assets WHERE id = ? AND org_id = ? AND channel = 'email'`,
    )
      .bind(str("asset_id"), user.org_id)
      .first<Record<string, unknown>>();
    if (!asset) return { error: "That email draft is gone." };
    const org = await env.DB.prepare(`SELECT name, slug, email, custom_domain FROM orgs WHERE id = ?`)
      .bind(user.org_id)
      .first<{ name: string; slug: string; email: string | null; custom_domain: string | null }>();
    const appOrigin = (env as unknown as { APP_ORIGIN?: string }).APP_ORIGIN ?? "https://viatutela.app";
    const siteUrl = org?.custom_domain ? `https://${org.custom_domain}` : `${appOrigin}/s/${org?.slug}`;

    const result = await sendSupporterEmail(env, {
      orgId: user.org_id,
      orgName: org?.name ?? "the rescue",
      orgEmail: org?.email ?? null,
      subject: String(asset.title ?? "News from the rescue"),
      body: String(asset.content),
      siteUrl,
      appOrigin,
    });
    ctx.waitUntil(
      env.DB.prepare(`UPDATE marketing_assets SET posted_at = COALESCE(posted_at, ?) WHERE id = ?`)
        .bind(new Date().toISOString(), asset.id)
        .run(),
    );
    if (result.attempted === 0) {
      return { error: `No sendable supporters yet (${result.skippedSuppressed} unsubscribed/invalid were skipped). Newsletter signups and donors with emails land here automatically.` };
    }
    return { ok: `Handed ${result.attempted} email${result.attempted === 1 ? "" : "s"} to the mail service (${result.skippedSuppressed} skipped as unsubscribed/invalid). Delivery needs the sender domain verified in Cloudflare.` };
  }

  return null;
}

const inputCls = "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

function MetaView({ metaJson }: { metaJson: string | null }) {
  if (!metaJson) return null;
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(metaJson) as Record<string, unknown>;
  } catch {
    return null;
  }
  const parts: React.ReactNode[] = [];
  if (Array.isArray(meta.hashtags) && meta.hashtags.length) {
    parts.push(
      <p key="h" className="text-xs text-sky-deep break-words">{(meta.hashtags as string[]).map((h) => `#${h}`).join(" ")}</p>,
    );
  }
  if (Array.isArray(meta.altSubjects) && meta.altSubjects.length) {
    parts.push(<p key="a" className="text-xs text-charcoal-soft">Alt subjects: {(meta.altSubjects as string[]).join(" · ")}</p>);
  }
  if (Array.isArray(meta.keywords) && meta.keywords.length) {
    parts.push(<p key="k" className="text-xs text-charcoal-soft">Keywords: {(meta.keywords as string[]).join(", ")}</p>);
  }
  if (Array.isArray(meta.headlines) && meta.headlines.length) {
    parts.push(
      <div key="g" className="text-xs text-charcoal-soft">
        Headlines: {(meta.headlines as string[]).join(" | ")}
        {Array.isArray(meta.descriptions) && <> — Descriptions: {(meta.descriptions as string[]).join(" | ")}</>}
      </div>,
    );
  }
  if (Array.isArray(meta.variants) && meta.variants.length) {
    parts.push(
      <ul key="v" className="text-xs text-charcoal-soft space-y-0.5">
        {(meta.variants as { primaryText: string; headline: string; description: string }[]).map((v, i) => (
          <li key={i}>#{i + 1} {v.headline} — {v.primaryText} — {v.description}</li>
        ))}
      </ul>,
    );
  }
  return parts.length ? <div className="mt-2 space-y-1">{parts}</div> : null;
}

export default function CampaignDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { campaign, assets, aiReady } = loaderData;
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const a = actionData as { ok?: string; error?: string } | undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/marketing" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Marketing Studio</Link>
        <h1 className="text-2xl font-display font-semibold">{String(campaign.name)}</h1>
        <p className="text-sm text-charcoal-soft">
          {String(campaign.objective).replace("_", " ")}
          {Boolean(campaign.animal_name) && <> · featuring {String(campaign.animal_name)}</>}
          {Boolean(campaign.key_message) && <> · "{String(campaign.key_message)}"</>}
        </p>
      </div>

      {(a?.ok || a?.error) && (
        <p className={`rounded-2xl px-4 py-3 font-semibold ${a.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`} role="status">
          {a.error ?? a.ok}
        </p>
      )}

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-lg">Draft a channel kit</h2>
        {!aiReady ? (
          <p className="mt-2 text-sm text-charcoal-soft">Needs the ANTHROPIC_API_KEY secret on the Worker — then pick channels and get paste-ready drafts in your voice.</p>
        ) : (
          <Form method="post" className="mt-3">
            <input type="hidden" name="intent" value="generate" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
              {CHANNELS.map((c) => (
                <label key={c.channel} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 font-semibold cursor-pointer hover:bg-sunflower-soft">
                  <input type="checkbox" name={`ch_${c.channel}`} defaultChecked={["facebook", "instagram", "story"].includes(c.channel)} />
                  {c.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-charcoal-soft">
              Google ads tip: nonprofits qualify for <strong>Google Ad Grants</strong> — $10k/month of free search ads. These drafts respect the character limits, so they paste straight in.
            </p>
            <button disabled={busy} className="mt-3 rounded-full bg-sky text-white px-6 py-2.5 font-display font-semibold shadow-soft disabled:opacity-50">
              {busy ? "Drafting…" : "Draft selected channels"}
            </button>
          </Form>
        )}
      </section>

      {assets.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display font-semibold text-lg">
            Drafts <span className="text-sm font-normal text-charcoal-soft">— yours to edit; nothing posts itself</span>
          </h2>
          {assets.map((asset) => {
            const posted = Boolean(asset.posted_at);
            return (
              <div key={String(asset.id)} className={`rounded-blob bg-white shadow-soft p-5 ${posted ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-sky/15 text-sky-deep px-3 py-1 text-xs font-bold uppercase tracking-wide">
                    {String(asset.channel).replace("_", " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    {posted && <span className="text-xs font-semibold text-meadow-deep">posted {String(asset.posted_at).slice(0, 10)}</span>}
                    {String(asset.channel) === "email" && !posted && (
                      <Form method="post" onSubmit={(e) => { if (!confirm("Send this to all subscribed supporters now?")) e.preventDefault(); }}>
                        <input type="hidden" name="intent" value="send-email" />
                        <input type="hidden" name="asset_id" value={String(asset.id)} />
                        <button className="rounded-full bg-meadow text-white px-4 py-1.5 text-xs font-semibold shadow-soft">
                          Send to supporters
                        </button>
                      </Form>
                    )}
                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle-posted" />
                      <input type="hidden" name="asset_id" value={String(asset.id)} />
                      <button className="rounded-full border-2 border-meadow text-meadow-deep px-4 py-1.5 text-xs font-semibold hover:bg-meadow hover:text-white transition-colors">
                        {posted ? "Un-mark posted" : "Mark posted"}
                      </button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete-asset" />
                      <input type="hidden" name="asset_id" value={String(asset.id)} />
                      <button aria-label="Delete draft" className="text-terracotta-deep font-bold text-sm">✕</button>
                    </Form>
                  </div>
                </div>
                <Form method="post" className="mt-3 space-y-2">
                  <input type="hidden" name="intent" value="update-asset" />
                  <input type="hidden" name="asset_id" value={String(asset.id)} />
                  <input name="title" defaultValue={String(asset.title ?? "")} placeholder="Title / subject" className={`${inputCls} w-full font-semibold`} />
                  <textarea
                    name="content"
                    defaultValue={String(asset.content)}
                    rows={Math.min(14, Math.max(4, String(asset.content).split("\n").length + 1))}
                    className={`${inputCls} w-full`}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <MetaView metaJson={asset.meta_json ? String(asset.meta_json) : null} />
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-charcoal-soft">
                      scheduled for
                      <input name="scheduled_for" type="date" defaultValue={asset.scheduled_for ? String(asset.scheduled_for) : ""} className={`${inputCls} ml-2`} />
                    </label>
                    <button className="rounded-full bg-sunflower px-4 py-1.5 text-xs font-semibold shadow-soft">Save</button>
                  </div>
                </Form>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
