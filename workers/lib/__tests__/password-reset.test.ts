import { describe, expect, it } from "vitest";
import { hashToken, isResetTokenFormat } from "../password-reset";

describe("reset token handling", () => {
  it("accepts only 48-hex tokens", () => {
    expect(isResetTokenFormat("a".repeat(48))).toBe(true);
    expect(isResetTokenFormat("a".repeat(47))).toBe(false);
    expect(isResetTokenFormat("A".repeat(48))).toBe(false); // hex is lowercase
    expect(isResetTokenFormat("")).toBe(false);
    expect(isResetTokenFormat("../../etc/passwd")).toBe(false);
  });

  it("hashes deterministically to 64-hex and never echoes the token", async () => {
    const token = "b".repeat(48);
    const h = await hashToken(token);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).toBe(await hashToken(token));
    expect(h).not.toContain(token);
    expect(await hashToken("c".repeat(48))).not.toBe(h);
  });
});
