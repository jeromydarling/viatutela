import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
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
