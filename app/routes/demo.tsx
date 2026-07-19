import { redirect } from "react-router";
import type { Route } from "./+types/demo";
import { getEnv } from "../lib/auth.server";
import { sessionCookie } from "../../workers/lib/auth";
import { createDemoSession, ensureDemoOrg, isDemoSeeded, resetDemoData } from "../../workers/lib/demo";

/**
 * One-click demo: seeds the demo shelter if needed, signs the visitor in
 * as the shared demo user, and drops them on the dashboard.
 */
export async function loader({ context, request }: Route.LoaderArgs) {
  const env = getEnv(context);
  await ensureDemoOrg(env);
  if (!(await isDemoSeeded(env))) {
    await resetDemoData(env, new URL(request.url).origin);
  }
  const token = await createDemoSession(env);
  return redirect("/app", { headers: { "Set-Cookie": sessionCookie(token, 24 * 3600) } });
}

export default function Demo() {
  return null;
}
