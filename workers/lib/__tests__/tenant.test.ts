import { describe, expect, it } from "vitest";
import { isPlatformHost } from "../domains";
import { routeTenantPath } from "../tenant";

const env = { PLATFORM_HOSTS: "viatutela.pet" } as unknown as Env;

describe("isPlatformHost", () => {
  it("never lets platform hosts fall into the custom-domain path", () => {
    expect(isPlatformHost("viatutela.jdoe.workers.dev", env)).toBe(true);
    expect(isPlatformHost("localhost", env)).toBe(true);
    expect(isPlatformHost("viatutela.pet", env)).toBe(true);
    expect(isPlatformHost("www.viatutela.pet", env)).toBe(true);
  });
  it("treats shelter domains as non-platform", () => {
    expect(isPlatformHost("happypawsrescue.org", env)).toBe(false);
    expect(isPlatformHost("www.happypawsrescue.org", env)).toBe(false);
  });
});

describe("routeTenantPath", () => {
  it("serves the site at / and /:page", () => {
    expect(routeTenantPath("/", "sunny")).toEqual({ kind: "rewrite", path: "/s/sunny" });
    expect(routeTenantPath("/about", "sunny")).toEqual({ kind: "rewrite", path: "/s/sunny/about" });
  });
  it("passes through assets, media, adoption catalog, and quick lookup", () => {
    expect(routeTenantPath("/adopt/sunny", "sunny").kind).toBe("passthrough");
    expect(routeTenantPath("/adopt/sunny/an_123", "sunny").kind).toBe("passthrough");
    expect(routeTenantPath("/api/media/orgs/x/p.jpg", "sunny").kind).toBe("passthrough");
    expect(routeTenantPath("/assets/entry.js", "sunny").kind).toBe("passthrough");
    expect(routeTenantPath("/a/an_123", "sunny").kind).toBe("passthrough");
  });
  it("emits tenant sitemap and robots", () => {
    expect(routeTenantPath("/sitemap.xml", "sunny").kind).toBe("sitemap");
    expect(routeTenantPath("/robots.txt", "sunny").kind).toBe("robots");
  });
  it("blocks the staff app and private surfaces so sessions stay per-tenant", () => {
    expect(routeTenantPath("/app", "sunny").kind).toBe("blocked");
    expect(routeTenantPath("/login", "sunny").kind).toBe("blocked");
    expect(routeTenantPath("/app/animals", "sunny").kind).toBe("blocked");
    expect(routeTenantPath("/api/export.zip", "sunny").kind).toBe("blocked");
    expect(routeTenantPath("/import", "sunny").kind).toBe("blocked");
  });
});
