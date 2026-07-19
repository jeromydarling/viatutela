/**
 * Client-bundle stub for @anthropic-ai/sdk. Every real call site lives in
 * loaders/actions (server-only), but their module-level imports survive
 * into the client graph and were shipping ~156KB of SDK to every app
 * page. The vite client environment aliases the SDK here instead.
 */
export default class Anthropic {
  constructor() {
    throw new Error("@anthropic-ai/sdk is server-only");
  }
}
