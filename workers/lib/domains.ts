/**
 * Custom domains: CNAME + automatic SSL via Cloudflare for SaaS.
 *
 * Design notes (lessons baked in):
 * - A Worker cannot fetch a custom hostname on its own zone — the
 *   authoritative liveness signal is the Custom Hostnames API's
 *   ssl.status === "active", plus the self-activation trick: a request
 *   arriving over HTTPS with an unrecognized Host IS the proof.
 * - Register both apex and www; match tenants on the bare domain.
 * - Everything idempotent — shelters mash buttons while DNS propagates.
 * - Degrades to a manual flow when CF_API_TOKEN/CF_ZONE_ID are unset.
 */

export function normalizeDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, ""); // strip protocol
  d = d.split("/")[0].split("?")[0].split("#")[0]; // strip path
  d = d.split(":")[0]; // strip port
  d = d.replace(/^www\./, ""); // store bare
  d = d.replace(/\.$/, ""); // trailing dot
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) return null;
  if (d.length > 253) return null;
  return d;
}

/** Strip www. for tenant matching so both variants resolve to the shelter. */
export function bareHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function isPlatformHost(host: string, env: Env): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.startsWith("localhost:") || h === "127.0.0.1") return true;
  if (h.endsWith(".workers.dev")) return true;
  const configured = ((env as unknown as { PLATFORM_HOSTS?: string }).PLATFORM_HOSTS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return configured.some((p) => h === p || bareHost(h) === p);
}

interface CfCreds {
  token: string;
  zoneId: string;
}

export function getCfCreds(env: Env): CfCreds | null {
  const e = env as unknown as { CF_API_TOKEN?: string; CF_ZONE_ID?: string };
  if (!e.CF_API_TOKEN || !e.CF_ZONE_ID) return null;
  return { token: e.CF_API_TOKEN, zoneId: e.CF_ZONE_ID };
}

const CF_API = "https://api.cloudflare.com/client/v4";

async function cfFetch(
  creds: CfCreds,
  path: string,
  init?: RequestInit,
): Promise<{ success: boolean; result?: unknown; errors?: unknown }> {
  const res = await fetch(`${CF_API}/zones/${creds.zoneId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return (await res.json()) as { success: boolean; result?: unknown; errors?: unknown };
}

export interface HostnameStatus {
  hostname: string;
  ssl_status: string | null; // pending_validation | pending_issuance | active | ...
  found: boolean;
}

/** Idempotent: GET by hostname first, create only if missing. */
export async function registerCustomHostname(
  creds: CfCreds,
  hostname: string,
): Promise<HostnameStatus> {
  const existing = await cfFetch(
    creds,
    `/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
  );
  const list = (existing.result as { hostname: string; ssl?: { status?: string } }[]) ?? [];
  if (existing.success && list.length > 0) {
    return { hostname, ssl_status: list[0].ssl?.status ?? null, found: true };
  }
  const created = await cfFetch(creds, `/custom_hostnames`, {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
    }),
  });
  if (!created.success) {
    console.log(`[custom hostname create failed] ${hostname}: ${JSON.stringify(created.errors)}`);
    return { hostname, ssl_status: null, found: false };
  }
  const result = created.result as { ssl?: { status?: string } };
  return { hostname, ssl_status: result.ssl?.status ?? "pending_validation", found: true };
}

/** Register both apex and www — visitors type both. */
export async function registerBothVariants(
  creds: CfCreds,
  bare: string,
): Promise<HostnameStatus[]> {
  return Promise.all([
    registerCustomHostname(creds, bare),
    registerCustomHostname(creds, `www.${bare}`),
  ]);
}

export async function getHostnameStatus(creds: CfCreds, hostname: string): Promise<HostnameStatus> {
  const res = await cfFetch(creds, `/custom_hostnames?hostname=${encodeURIComponent(hostname)}`);
  const list = (res.result as { ssl?: { status?: string } }[]) ?? [];
  if (!res.success || list.length === 0) return { hostname, ssl_status: null, found: false };
  return { hostname, ssl_status: list[0].ssl?.status ?? null, found: true };
}

/**
 * Informational DNS check via DNS-over-HTTPS. Propagation lags — the UI
 * must say so rather than treating a miss as failure.
 */
export interface DnsCheck {
  name: string;
  points_at: string | null;
  matches: boolean;
}

export async function checkDns(name: string, expectedTarget: string): Promise<DnsCheck> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=CNAME`,
      { headers: { accept: "application/dns-json" } },
    );
    const data = (await res.json()) as { Answer?: { type: number; data: string }[] };
    const cname = data.Answer?.find((a) => a.type === 5)?.data?.replace(/\.$/, "").toLowerCase() ?? null;
    const expected = expectedTarget.toLowerCase().replace(/\.$/, "");
    // Cloudflare-managed DNS flattens apex CNAMEs to A records; an A answer
    // can't be compared, so we only report a confident match on CNAME.
    return { name, points_at: cname, matches: cname === expected };
  } catch {
    return { name, points_at: null, matches: false };
  }
}

export function customDomainTarget(env: Env, fallbackHost: string): string {
  return (
    (env as unknown as { CUSTOM_DOMAIN_TARGET?: string }).CUSTOM_DOMAIN_TARGET || fallbackHost
  );
}

/** KV marker so the first HTTPS request self-activates the domain. */
export async function setPendingDomain(env: Env, domain: string, orgId: string): Promise<void> {
  await env.CONFIG.put(`pending_domain:${domain}`, orgId, { expirationTtl: 90 * 24 * 3600 });
}

export async function takePendingDomain(env: Env, domain: string): Promise<string | null> {
  const orgId = await env.CONFIG.get(`pending_domain:${domain}`);
  if (orgId) await env.CONFIG.delete(`pending_domain:${domain}`);
  return orgId;
}
