import { describe, expect, it } from "vitest";
import {
  buildShiftsIcs,
  cleanEventList,
  decodeCursor,
  encodeCursor,
  generateApiKey,
  hashApiKey,
  isApiKeyFormat,
  signWebhook,
  validateWebhookUrl,
  webhookSubscribes,
} from "../integrations";

describe("api keys", () => {
  it("generates well-formed keys that verify their own format", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^vt_live_[a-f0-9]{48}$/);
    expect(isApiKeyFormat(key)).toBe(true);
    expect(generateApiKey()).not.toBe(key);
  });

  it("rejects malformed tokens before any DB work", () => {
    for (const bad of ["", "vt_live_", "vt_live_XYZ", "sk_live_" + "a".repeat(48), "vt_live_" + "a".repeat(47), `vt_live_${"a".repeat(48)} `]) {
      expect(isApiKeyFormat(bad)).toBe(false);
    }
  });

  it("hashes deterministically and never returns the input", async () => {
    const key = generateApiKey();
    const h1 = await hashApiKey(key);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
    expect(h1).toBe(await hashApiKey(key));
    expect(h1).not.toContain(key.slice(8));
  });
});

describe("cursor", () => {
  it("round-trips created_at + id", () => {
    const c = encodeCursor("2026-07-19 22:00:01", "an_abc123");
    expect(decodeCursor(c)).toEqual({ createdAt: "2026-07-19 22:00:01", id: "an_abc123" });
  });

  it("survives ids containing the separator", () => {
    const c = encodeCursor("2026-01-01 00:00:00", "weird|id");
    expect(decodeCursor(c)?.id).toBe("id");
  });

  it("rejects garbage", () => {
    expect(decodeCursor("!!!not-base64!!!")).toBeNull();
    expect(decodeCursor(btoa("no-separator"))).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });
});

describe("webhook events", () => {
  it("cleans submitted event lists down to known events", () => {
    expect(cleanEventList(["application.created", "hack.everything", "donation.created"])).toBe(
      "application.created,donation.created",
    );
    expect(cleanEventList(["nope"])).toBe("");
  });

  it("matches subscriptions exactly, and ping always delivers", () => {
    expect(webhookSubscribes("application.created,donation.created", "donation.created")).toBe(true);
    expect(webhookSubscribes("application.created", "donation.created")).toBe(false);
    expect(webhookSubscribes("application.created", "application")).toBe(false);
    expect(webhookSubscribes("donation.created", "ping")).toBe(true);
  });
});

describe("validateWebhookUrl (SSRF guard)", () => {
  it("accepts normal public https endpoints", () => {
    for (const url of [
      "https://hooks.zapier.com/hooks/catch/123/abc/",
      "https://hook.eu1.make.com/xyz",
      "https://my-n8n.example.org/webhook/1",
    ]) {
      const res = validateWebhookUrl(url);
      expect(res.ok).toBe(true);
    }
  });

  it("rejects everything that isn't public https", () => {
    for (const url of [
      "http://hooks.zapier.com/x", // plain http
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://[::1]/x",
      "https://10.0.0.5/x",
      "https://192.168.1.1:8443/x",
      "https://metadata.internal/computeMetadata",
      "https://router.local/x",
      "https://intranet/x", // single label
      "https://user:pass@example.com/x", // embedded credentials
      "ftp://example.com/x",
      "not a url",
    ]) {
      expect(validateWebhookUrl(url).ok, url).toBe(false);
    }
  });
});

describe("signWebhook", () => {
  it("produces a stable HMAC bound to timestamp and body", async () => {
    const sig = await signWebhook("secret123", "1700000000000", `{"event":"ping"}`);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(sig).toBe(await signWebhook("secret123", "1700000000000", `{"event":"ping"}`));
    expect(sig).not.toBe(await signWebhook("secret123", "1700000000001", `{"event":"ping"}`));
    expect(sig).not.toBe(await signWebhook("other", "1700000000000", `{"event":"ping"}`));
  });
});

describe("buildShiftsIcs", () => {
  const shift = {
    id: "sh_1",
    title: "Morning dog walks; kennel A, B",
    date: "2026-08-01",
    start_time: "09:00",
    end_time: "11:00",
    notes: "Bring treats,\nand patience",
  };

  it("emits a valid calendar with escaped text and CRLF lines", () => {
    const ics = buildShiftsIcs("Sunny Meadow", [shift]);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("SUMMARY:Morning dog walks\\; kennel A\\, B");
    expect(ics).toContain("DTSTART:20260801T090000");
    expect(ics).toContain("DTEND:20260801T110000");
    expect(ics).toContain("DESCRIPTION:Bring treats\\,\\nand patience");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("falls back to all-day events without times and skips bad dates", () => {
    const ics = buildShiftsIcs("Org", [
      { ...shift, id: "sh_2", start_time: null, end_time: null },
      { ...shift, id: "sh_3", date: "not-a-date" },
    ]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260801");
    expect(ics).not.toContain("sh_3@tutela");
  });
});
