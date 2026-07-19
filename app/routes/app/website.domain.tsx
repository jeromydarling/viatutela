import { Form, Link } from "react-router";
import type { Route } from "./+types/website.domain";
import { requireUser } from "../../lib/auth.server";
import {
  bareHost,
  checkDns,
  customDomainTarget,
  getCfCreds,
  getHostnameStatus,
  normalizeDomain,
  registerBothVariants,
  setPendingDomain,
  type DnsCheck,
  type HostnameStatus,
} from "../../../workers/lib/domains";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Custom domain — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const org = await env.DB.prepare(`SELECT custom_domain, domain_status FROM orgs WHERE id = ?`)
    .bind(user.org_id)
    .first<{ custom_domain: string | null; domain_status: string | null }>();
  const target = customDomainTarget(env, new URL(request.url).hostname);
  return {
    domain: org?.custom_domain ?? null,
    status: org?.domain_status ?? null,
    target,
    automated: Boolean(getCfCreds(env)),
    slug: user.slug,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const target = customDomainTarget(env, new URL(request.url).hostname);
  const creds = getCfCreds(env);

  if (intent === "save-domain") {
    const domain = normalizeDomain(String(f.get("domain") ?? ""));
    if (!domain) {
      return { error: "That doesn't look like a domain — try something like happypawsrescue.org (no http://, no paths)." };
    }
    const taken = await env.DB.prepare(
      `SELECT id FROM orgs WHERE custom_domain = ? AND id != ?`,
    ).bind(domain, user.org_id).first();
    if (taken) return { error: "That domain is already connected to another shelter." };

    // store as pending; the tenant middleware self-activates on first HTTPS visit
    await env.DB.prepare(
      `UPDATE orgs SET custom_domain = NULL, domain_status = ? WHERE id = ?`,
    ).bind(creds ? "pending" : "manual", user.org_id).run();
    await setPendingDomain(env, domain, user.org_id);
    await env.CONFIG.put(`domain_of:${user.org_id}`, domain, { expirationTtl: 90 * 24 * 3600 });

    let registered: HostnameStatus[] = [];
    if (creds) {
      registered = await registerBothVariants(creds, domain);
    } else {
      console.log(`[custom domain manual mode] org=${user.org_id} domain=${domain} — add the custom hostname in the Cloudflare dashboard`);
    }
    return {
      ok: creds
        ? `Saved. Now add the CNAME at your registrar and we'll take it from there — certificates usually go active in under a minute once DNS points here.`
        : `Saved in manual mode. Add the CNAME at your registrar; the platform operator also needs to add "${domain}" and "www.${domain}" as custom hostnames in Cloudflare (SSL/TLS → Custom Hostnames).`,
      registered,
      savedDomain: domain,
    };
  }

  if (intent === "check-dns") {
    const domain = String(f.get("domain") ?? "");
    const bare = bareHost(domain);
    const checks: DnsCheck[] = await Promise.all([
      checkDns(bare, target),
      checkDns(`www.${bare}`, target),
    ]);
    return { checks, checkedDomain: bare };
  }

  if (intent === "check-status") {
    const domain = bareHost(String(f.get("domain") ?? ""));
    if (!creds) return { error: "Automatic status checks need the Cloudflare API token configured — see manual steps below." };
    const statuses = await Promise.all([
      getHostnameStatus(creds, domain),
      getHostnameStatus(creds, `www.${domain}`),
    ]);
    // belt to the suspenders: if the cert is active, flip the registry now
    if (statuses.some((s) => s.ssl_status === "active")) {
      const pending = await env.CONFIG.get(`pending_domain:${domain}`);
      if (pending === user.org_id) {
        await env.DB.prepare(
          `UPDATE orgs SET custom_domain = ?, domain_status = 'active' WHERE id = ? AND custom_domain IS NULL`,
        ).bind(domain, user.org_id).run();
        await env.CONFIG.delete(`pending_domain:${domain}`);
        return { ok: `Certificate is live — ${domain} is now serving your site. 🎉`, statuses };
      }
    }
    return { statuses };
  }

  if (intent === "remove-domain") {
    const org = await env.DB.prepare(`SELECT custom_domain FROM orgs WHERE id = ?`)
      .bind(user.org_id).first<{ custom_domain: string | null }>();
    if (org?.custom_domain) await env.CONFIG.delete(`pending_domain:${org.custom_domain}`);
    const stored = await env.CONFIG.get(`domain_of:${user.org_id}`);
    if (stored) {
      await env.CONFIG.delete(`pending_domain:${stored}`);
      await env.CONFIG.delete(`domain_of:${user.org_id}`);
    }
    await env.DB.prepare(`UPDATE orgs SET custom_domain = NULL, domain_status = NULL WHERE id = ?`)
      .bind(user.org_id).run();
    return { ok: "Domain disconnected. Your site still lives at its Tutela address." };
  }
  return null;
}

export default function DomainSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { domain, status, target, automated, slug } = loaderData;
  const savedDomain = actionData?.savedDomain ?? domain;
  const pendingDomain = actionData?.checkedDomain ?? savedDomain;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/app/website" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Website</Link>
        <h1 className="mt-2 text-2xl font-display font-semibold">Custom domain</h1>
        <p className="mt-2 text-charcoal-soft">
          Put your site on your own domain. One CNAME record, automatic SSL, no strings —
          your Tutela address keeps working either way.
        </p>
      </div>

      {(actionData?.ok || actionData?.error) && (
        <p className={`rounded-2xl px-4 py-3 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`} role="status">
          {actionData.error ?? actionData.ok}
        </p>
      )}

      {domain && status === "active" ? (
        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-lg">🎉 Connected</h2>
          <p className="mt-2">
            Your site is live at <a href={`https://${domain}`} className="font-semibold text-meadow-deep underline">{domain}</a>
          </p>
          <Form method="post" className="mt-4" onSubmit={(e) => { if (!confirm("Disconnect this domain?")) e.preventDefault(); }}>
            <input type="hidden" name="intent" value="remove-domain" />
            <button className="text-sm font-semibold text-terracotta-deep hover:underline">Disconnect</button>
          </Form>
        </section>
      ) : (
        <>
          <section className="rounded-blob bg-white shadow-soft p-6 space-y-3">
            <h2 className="font-display font-semibold text-lg">1 · Tell us your domain</h2>
            <Form method="post" className="flex flex-wrap gap-2">
              <input type="hidden" name="intent" value="save-domain" />
              <input
                name="domain"
                defaultValue={pendingDomain ?? ""}
                placeholder="happypawsrescue.org"
                required
                className="flex-1 min-w-56 rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none"
              />
              <button className="rounded-full bg-sunflower px-6 py-2.5 font-display font-semibold shadow-soft">
                Save domain
              </button>
            </Form>
          </section>

          <section className="rounded-blob bg-white shadow-soft p-6 space-y-3">
            <h2 className="font-display font-semibold text-lg">2 · Add one CNAME at your registrar</h2>
            <div className="rounded-2xl bg-cream p-4 font-mono text-sm space-y-1">
              <p>Type: <strong>CNAME</strong></p>
              <p>Name: <strong>www</strong> (and <strong>@</strong> if your DNS host allows it)</p>
              <p>Target: <strong>{target}</strong></p>
            </div>
            <p className="text-sm text-charcoal-soft">
              Some DNS hosts don't allow a CNAME on the bare domain (the "apex"). Pointing{" "}
              <strong>www</strong> always works — for the apex, use your host's ALIAS/ANAME record
              or domain forwarding to www. We answer on both.
            </p>
          </section>

          <section className="rounded-blob bg-white shadow-soft p-6 space-y-3">
            <h2 className="font-display font-semibold text-lg">3 · Check & go live</h2>
            <p className="text-sm text-charcoal-soft">
              Once DNS points here, the certificate issues automatically and your first visit to
              the domain switches it on — no button to press. These checks are just for peace of
              mind; DNS can take a while to propagate, so an early "not yet" is normal.
            </p>
            <div className="flex flex-wrap gap-2">
              <Form method="post">
                <input type="hidden" name="intent" value="check-dns" />
                <input type="hidden" name="domain" value={pendingDomain ?? ""} />
                <button disabled={!pendingDomain} className="rounded-full border-2 border-sky text-sky-deep px-5 py-2 text-sm font-semibold hover:bg-sky hover:text-white transition-colors disabled:opacity-40">
                  Check my DNS
                </button>
              </Form>
              {automated && (
                <Form method="post">
                  <input type="hidden" name="intent" value="check-status" />
                  <input type="hidden" name="domain" value={pendingDomain ?? ""} />
                  <button disabled={!pendingDomain} className="rounded-full border-2 border-meadow text-meadow-deep px-5 py-2 text-sm font-semibold hover:bg-meadow hover:text-white transition-colors disabled:opacity-40">
                    Check certificate
                  </button>
                </Form>
              )}
            </div>

            {actionData?.checks && (
              <ul className="text-sm space-y-1">
                {actionData.checks.map((c) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span>{c.matches ? "✅" : "⏳"}</span>
                    <span className="font-mono">{c.name}</span>
                    <span className="text-charcoal-soft">
                      {c.points_at ? `→ ${c.points_at}` : "no CNAME visible yet (propagation can lag)"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {actionData?.statuses && (
              <ul className="text-sm space-y-1">
                {actionData.statuses.map((s) => (
                  <li key={s.hostname} className="flex items-center gap-2">
                    <span>{s.ssl_status === "active" ? "✅" : "⏳"}</span>
                    <span className="font-mono">{s.hostname}</span>
                    <span className="text-charcoal-soft">certificate: {s.ssl_status ?? "not registered yet"}</span>
                  </li>
                ))}
              </ul>
            )}
            {actionData?.registered && (
              <p className="text-xs text-charcoal-soft">
                Registered with the certificate authority: {actionData.registered.map((r) => `${r.hostname} (${r.ssl_status ?? "pending"})`).join(" · ")}
              </p>
            )}
          </section>

          {!automated && (
            <p className="rounded-2xl bg-sky/15 text-sky-deep px-4 py-3 text-sm font-semibold">
              Heads-up for the platform operator: automatic SSL needs Cloudflare for SaaS enabled on
              the platform zone plus two Worker secrets (<code>CF_API_TOKEN</code> scoped to that
              zone with SSL &amp; Custom Hostnames edit, and <code>CF_ZONE_ID</code>), and{" "}
              <code>CUSTOM_DOMAIN_TARGET</code>/<code>PLATFORM_HOSTS</code> vars. Until then,
              domains save in manual mode and hostnames are added by hand.
            </p>
          )}
        </>
      )}

      <p className="text-sm text-charcoal-soft">
        Your permanent address always works: <span className="font-mono">/s/{slug}</span>
      </p>
    </div>
  );
}
