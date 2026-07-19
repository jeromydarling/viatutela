/**
 * Minimal error reporting — no SDK dependency. When SENTRY_DSN is set
 * (a publishable client key, safe in vars), unhandled errors POST to
 * Sentry's store endpoint; otherwise they log to console. Reporting is
 * best-effort and must never make an outage worse.
 */

export async function reportError(env: Env, err: unknown, context: string): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.log(`[unhandled ${context}] ${message}`);
  const dsn = (env as unknown as { SENTRY_DSN?: string }).SENTRY_DSN;
  if (!dsn) return;
  try {
    // DSN: https://<key>@<host>/<projectId>
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/\//g, "");
    if (!u.username || !projectId) return;
    await fetch(`https://${u.host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=viatutela/1.0, sentry_key=${u.username}`,
      },
      body: JSON.stringify({
        platform: "javascript",
        level: "error",
        logger: context,
        message: { formatted: message.slice(0, 1000) },
        exception: {
          values: [
            {
              type: err instanceof Error ? err.name : "Error",
              value: message.slice(0, 1000),
              stacktrace: stack ? { frames: parseFrames(stack) } : undefined,
            },
          ],
        },
        tags: { context },
      }),
    });
  } catch {
    // never let telemetry throw
  }
}

function parseFrames(stack: string): { filename: string; function: string; lineno?: number }[] {
  return stack
    .split("\n")
    .slice(1, 21)
    .map((line) => {
      const m = line.trim().match(/^at (?:(.+?) )?\(?(.+?)(?::(\d+))?(?::\d+)?\)?$/);
      return { function: m?.[1] ?? "?", filename: m?.[2] ?? line.trim(), lineno: m?.[3] ? Number(m[3]) : undefined };
    })
    .reverse();
}
