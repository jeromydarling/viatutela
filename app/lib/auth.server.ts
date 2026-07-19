import { redirect } from "react-router";
import type { RouterContextProvider } from "react-router";
import { cloudflareContext } from "../cloudflare-context";
import { getAuthedUser, type AuthedUser } from "../../workers/lib/auth";

export async function requireUser(
  context: Readonly<RouterContextProvider>,
  request: Request,
): Promise<{ env: Env; ctx: ExecutionContext; user: AuthedUser }> {
  const { env, ctx } = context.get(cloudflareContext);
  const user = await getAuthedUser(env, request);
  if (!user) throw redirect("/login");
  return { env, ctx, user };
}

export function getEnv(context: Readonly<RouterContextProvider>): Env {
  return context.get(cloudflareContext).env;
}
