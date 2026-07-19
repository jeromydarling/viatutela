/**
 * Featherweight AI capability check — deliberately free of any SDK
 * import. Route modules import this for UI gating; pulling it from
 * ai-shelter dragged the whole Anthropic SDK into the CLIENT bundle
 * (~156KB of dead JS on every app page).
 */

export function aiAvailable(env: Env): boolean {
  const e = env as { ANTHROPIC_API_KEY?: string; AI?: unknown };
  return Boolean((e.ANTHROPIC_API_KEY ?? "").trim() || e.AI);
}
