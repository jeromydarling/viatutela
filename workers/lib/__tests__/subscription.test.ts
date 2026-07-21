import { describe, expect, it } from "vitest";
import { FREE_ADOPTION_GRACE, billingGate, billingState } from "../subscription";

/** Minimal D1 stub: canned rows keyed by which query is asked. */
function fakeEnv(opts: {
  hasKey?: boolean;
  org?: Partial<{ plan: string; demo: number; billing_method_on_file: number; subscription_status: string; stripe_customer_id: string | null }>;
  adoptionCount?: number;
}): Env {
  const env: Record<string, unknown> = {};
  if (opts.hasKey) env.STRIPE_SECRET_KEY = "sk_test_x";
  env.DB = {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("COUNT(*) n FROM adoptions")) return { n: opts.adoptionCount ?? 0 };
              if (sql.includes("FROM orgs")) {
                if (opts.org === undefined) return null;
                return {
                  plan: opts.org.plan ?? "starter",
                  demo: opts.org.demo ?? 0,
                  billing_method_on_file: opts.org.billing_method_on_file ?? 0,
                  subscription_status: opts.org.subscription_status ?? "none",
                  stripe_customer_id: opts.org.stripe_customer_id ?? null,
                };
              }
              return null;
            },
          };
        },
      };
    },
  };
  return env as unknown as Env;
}

describe("billingGate", () => {
  it("always allows when platform billing is dark (no key)", async () => {
    const env = fakeEnv({ hasKey: false, org: {}, adoptionCount: 999 });
    expect((await billingGate(env, "org_1")).allowed).toBe(true);
  });

  it("always allows the demo org", async () => {
    const env = fakeEnv({ hasKey: true, org: { demo: 1 }, adoptionCount: 999 });
    expect((await billingGate(env, "org_demo")).allowed).toBe(true);
  });

  it("allows inside the free grace, blocks after when no card", async () => {
    const under = fakeEnv({ hasKey: true, org: {}, adoptionCount: FREE_ADOPTION_GRACE - 1 });
    expect((await billingGate(under, "o")).allowed).toBe(true);

    const over = fakeEnv({ hasKey: true, org: {}, adoptionCount: FREE_ADOPTION_GRACE });
    const res = await billingGate(over, "o");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("payment method");
  });

  it("allows past grace once a card is on file", async () => {
    const env = fakeEnv({ hasKey: true, org: { billing_method_on_file: 1 }, adoptionCount: 500 });
    expect((await billingGate(env, "o")).allowed).toBe(true);
  });
});

describe("billingState", () => {
  it("reports grace remaining and gated flag", async () => {
    const env = fakeEnv({ hasKey: true, org: {}, adoptionCount: FREE_ADOPTION_GRACE });
    const s = await billingState(env, "o");
    expect(s.live).toBe(true);
    expect(s.graceRemaining).toBe(0);
    expect(s.gated).toBe(true);
    expect(s.methodOnFile).toBe(false);
  });

  it("is never gated while billing is dark", async () => {
    const env = fakeEnv({ hasKey: false, org: {}, adoptionCount: 500 });
    const s = await billingState(env, "o");
    expect(s.live).toBe(false);
    expect(s.gated).toBe(false);
  });
});
