import { describe, expect, it } from "vitest";
import { normalizePhone } from "../sms";

describe("normalizePhone", () => {
  it("normalizes US formats to E.164", () => {
    expect(normalizePhone("(555) 010-2211")).toBe("+15550102211");
    expect(normalizePhone("555-010-2211")).toBe("+15550102211");
    expect(normalizePhone("1 555 010 2211")).toBe("+15550102211");
    expect(normalizePhone("+15550102211")).toBe("+15550102211");
  });
  it("passes through international E.164 and rejects garbage", () => {
    expect(normalizePhone("+447911123456")).toBe("+447911123456");
    expect(normalizePhone("not a phone")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
