import { describe, expect, it } from "vitest";
import { isSpam, scoreSpam, SPAM_THRESHOLD } from "../spam";

describe("scoreSpam", () => {
  it("flags the real SEO-services spam sample", () => {
    const s = scoreSpam({
      name: "Karol Coward",
      email: "domains@search-viatutela.pet",
      message:
        "Greetings Feature viatutela.pet in Google's Search Index so it can be visible in online search results! Add viatutela.pet today: helpindex.pro",
    });
    expect(s.score).toBeGreaterThanOrEqual(SPAM_THRESHOLD);
    expect(isSpam({
      name: "Karol Coward",
      email: "domains@search-viatutela.pet",
      message: "Greetings ... Google's Search Index ... helpindex.pro",
    })).toBe(true);
  });

  it("flags common contact-form spam shapes", () => {
    for (const message of [
      "Hello, I can get your website on the first page of Google. Cheap SEO backlinks, reply for details.",
      "Boost your website traffic with our digital marketing services! Visit growfast.biz now.",
      "Invest in bitcoin today and make money from home — guaranteed returns at cryptowin.online",
      "We can list your business and get indexed fast. Check ranking-pros.com",
    ]) {
      expect(isSpam({ name: "Bot", email: "x@spammer.xyz", message }), message).toBe(true);
    }
  });

  it("lets genuine shelter inquiries through", () => {
    for (const message of [
      "Hi! We're a small dog rescue in Ohio thinking about switching from Petstablished. Does the importer keep our adoption history?",
      "How does the $9 plan work exactly — is it really capped at $30 a month?",
      "We'd love a demo for our board meeting next Tuesday. Can you help us get set up?",
      "Question about online giving — do donors really cover the fees? Our treasurer is skeptical.",
      "Just wanted to say the photo studio is wonderful. Thank you for building this for shelters.",
    ]) {
      const s = scoreSpam({ name: "Dana Rivera", email: "dana@sunnymeadow.org", message });
      expect(s.score, `false positive: "${message}" → ${s.reasons.join(", ")}`).toBeLessThan(SPAM_THRESHOLD);
    }
  });

  it("a legit message that happens to mention a link once isn't nuked alone", () => {
    // one bare link, no pitch phrases — a real person sharing their site
    const s = scoreSpam({
      name: "Real Person",
      email: "hi@realrescue.org",
      message: "Our current site is realrescue.org and we're hoping to move it to Tutela. Is that possible?",
    });
    expect(s.score).toBeLessThan(SPAM_THRESHOLD);
  });
});
