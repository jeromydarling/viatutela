import { createContext } from "react-router";

/** Router context key carrying the Cloudflare bindings into loaders/actions. */
export const cloudflareContext = createContext<{
  env: Env;
  ctx: ExecutionContext;
}>();
