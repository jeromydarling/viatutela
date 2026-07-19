import { describe, expect, it } from "vitest";
import { b64urlDecode, b64urlEncode, filterRecipients, makeUnsubToken, verifyUnsubToken } from "../supporter-email";

// Minimal env: KV-backed secret via a Map; enough for token round-trips.
function fakeEnv(): Env {
  const kv = new Map<string, string>();
  return {
    CONFIG: {
      get: async (k: string) => kv.get(k) ?? null,
      put: async (k: string, v: string) => void kv.set(k, v),
    },
  } as unknown as Env;
}

describe("unsubscribe tokens", () => {
  it("round-trips and rejects tampering", async () => {
    const env = fakeEnv();
    const token = await makeUnsubToken(env, "org_1", "Person@Example.COM");
    const ok = await verifyUnsubToken(env, token);
    expect(ok).toEqual({ orgId: "org_1", email: "person@example.com" });

    // flip the mac
    const parts = token.split(".");
    const bad = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}${parts[2].endsWith("a") ? "b" : "a"}`;
    expect(await verifyUnsubToken(env, bad)).toBeNull();

    // swap the email for someone else's
    const forged = `${b64urlEncode("victim@example.com")}.${parts[1]}.${parts[2]}`;
    expect(await verifyUnsubToken(env, forged)).toBeNull();

    expect(await verifyUnsubToken(env, "garbage")).toBeNull();
  });

  it("b64url helpers survive weird emails", () => {
    const email = "a+tag@ex.org";
    expect(b64urlDecode(b64urlEncode(email))).toBe(email);
  });
});

describe("filterRecipients — suppression respected on send", () => {
  it("drops suppressed, invalid, and duplicate emails", () => {
    const out = filterRecipients(
      [
        { name: "A", email: "a@ex.org" },
        { name: "A2", email: "A@EX.ORG" }, // dup, different case
        { name: "B", email: "unsubscribed@ex.org" },
        { name: "C", email: "not-an-email" },
        { name: "D", email: null },
        { name: "E", email: "e@ex.org" },
      ],
      new Set(["unsubscribed@ex.org"]),
    );
    expect(out.map((r) => r.email)).toEqual(["a@ex.org", "e@ex.org"]);
  });
});
