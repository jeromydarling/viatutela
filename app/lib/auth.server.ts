import { redirect } from "react-router";
import type { RouterContextProvider } from "react-router";
import { cloudflareContext } from "../cloudflare-context";
import { getAuthedUser, type AuthedUser } from "../../workers/lib/auth";

// One auth lookup per request: on a document load the layout loader AND
// the child loader both call requireUser, which used to mean two identical
// session JOINs. The context provider is per-request, so it's a safe key.
const authCache = new WeakMap<object, Promise<AuthedUser | null>>();

export async function requireUser(
  context: Readonly<RouterContextProvider>,
  request: Request,
): Promise<{ env: Env; ctx: ExecutionContext; user: AuthedUser }> {
  const { env, ctx } = context.get(cloudflareContext);
  let pending = authCache.get(context);
  if (!pending) {
    pending = getAuthedUser(env, request);
    authCache.set(context, pending);
  }
  const user = await pending;
  if (!user) throw redirect("/login");
  return { env, ctx, user };
}

export function getEnv(context: Readonly<RouterContextProvider>): Env {
  return context.get(cloudflareContext).env;
}
