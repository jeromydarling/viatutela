import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * The Anthropic SDK is server-only; loader-level imports were dragging
 * ~156KB of it into the client bundle. Resolve it to a throwing stub in
 * the client environment.
 */
const anthropicClientStub = {
  name: "anthropic-client-stub",
  enforce: "pre" as const,
  resolveId(this: { environment?: { name?: string } }, id: string) {
    if (id === "@anthropic-ai/sdk" && this.environment?.name === "client") {
      return `${import.meta.dirname}/app/lib/anthropic-client-stub.ts`;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [
    anthropicClientStub,
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // Keep `vite dev` fully local (Miniflare) — no Cloudflare credentials
      // needed to develop. Flip to true to proxy bindings to the real
      // account during dev (requires `wrangler login`).
      remoteBindings: false,
    }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
