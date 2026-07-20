import { describe, expect, it } from "vitest";
import {
  CARD_FIXED_CENTS,
  CARD_RATE_BPS,
  PLATFORM_FEE_BPS,
  feeCoverCents,
  platformFeeCents,
  verifyStripeSignature,
} from "../stripe";

describe("fee math (integer cents)", () => {
  it("platform fee is 2%, floored", () => {
    expect(platformFeeCents(10_000)).toBe(200); // $100 → $2.00
    expect(platformFeeCents(2_599)).toBe(51);
    expect(platformFeeCents(0)).toBe(0);
  });

  it("fee cover leaves the shelter with at least the base gift", () => {
    for (const base of [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 100_000, 2_500_000]) {
      const cover = feeCoverCents(base);
      const total = base + cover;
      const cardFee = Math.ceil((total * CARD_RATE_BPS) / 10_000) + CARD_FIXED_CENTS;
      const platformFee = platformFeeCents(total);
      const net = total - cardFee - platformFee;
      expect(net, `base ${base}`).toBeGreaterThanOrEqual(base - 1); // ±1¢ rounding
      expect(cover).toBeGreaterThan(0);
      expect(cover).toBeLessThan(base * 0.08 + 100); // never an absurd add-on
    }
  });

  it("cover on a $25 gift is around $1.60", () => {
    const cover = feeCoverCents(2_500);
    expect(cover).toBeGreaterThanOrEqual(150);
    expect(cover).toBeLessThanOrEqual(175);
  });
});

describe("verifyStripeSignature", () => {
  const SECRET = "whsec_test_secret";
  const env = { STRIPE_WEBHOOK_SECRET: SECRET } as unknown as Env;

  async function sign(payload: string, timestamp: number): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  it("accepts a valid v1 signature within tolerance", async () => {
    const now = 1_800_000_000_000;
    const ts = Math.floor(now / 1000);
    const payload = `{"type":"checkout.session.completed"}`;
    const header = `t=${ts},v1=${await sign(payload, ts)}`;
    expect(await verifyStripeSignature(env, payload, header, 300, now)).toBe(true);
  });

  it("rejects stale timestamps, tampered payloads, and bad headers", async () => {
    const now = 1_800_000_000_000;
    const staleTs = Math.floor(now / 1000) - 3_600;
    const payload = `{"a":1}`;
    const staleHeader = `t=${staleTs},v1=${await sign(payload, staleTs)}`;
    expect(await verifyStripeSignature(env, payload, staleHeader, 300, now)).toBe(false);

    const ts = Math.floor(now / 1000);
    const goodSig = await sign(payload, ts);
    expect(await verifyStripeSignature(env, `{"a":2}`, `t=${ts},v1=${goodSig}`, 300, now)).toBe(false);
    expect(await verifyStripeSignature(env, payload, `t=${ts},v1=deadbeef`, 300, now)).toBe(false);
    expect(await verifyStripeSignature(env, payload, null, 300, now)).toBe(false);
    expect(await verifyStripeSignature(env, payload, "", 300, now)).toBe(false);
  });

  it("fails closed without a webhook secret", async () => {
    const bare = {} as unknown as Env;
    expect(await verifyStripeSignature(bare, "x", "t=1,v1=aa", 300)).toBe(false);
  });
});

describe("constants sanity", () => {
  it("platform fee is the disclosed 2%", () => {
    expect(PLATFORM_FEE_BPS).toBe(200);
  });
});
