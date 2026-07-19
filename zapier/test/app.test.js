"use strict";

const zapier = require("zapier-platform-core");
const App = require("../index");

const appTester = zapier.createAppTester(App);
zapier.tools.env.inject();

// Live tests need a running server + key:
//   BASE_URL=http://localhost:5173 TUTELA_API_KEY=vt_live_… npm test
const KEY = process.env.TUTELA_API_KEY;
const liveTest = KEY ? test : test.skip;

describe("app definition", () => {
  test("exports five triggers, three creates, one search", () => {
    expect(Object.keys(App.triggers)).toHaveLength(5);
    expect(Object.keys(App.creates)).toHaveLength(3);
    expect(Object.keys(App.searches)).toHaveLength(1);
  });

  test("hook perform flattens the delivery envelope", async () => {
    const results = await appTester(App.triggers.new_application.operation.perform, {
      cleanedRequest: {
        event: "application.created",
        delivery_id: "whd_x",
        timestamp: "2026-07-19T00:00:00Z",
        data: { id: "ap_1", name: "Jordan", animal_name: "Biscuit" },
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("ap_1");
    expect(results[0].event).toBe("application.created");
  });
});

describe("live API", () => {
  const authData = { api_key: KEY };

  liveTest("auth test reaches /v1/me", async () => {
    const resp = await appTester(
      async (z) => (await z.request({ url: `${require("../lib/base").API}/me` })).data,
      { authData },
    );
    expect(resp.org_name).toBeTruthy();
  });

  liveTest("performList returns editor samples for every trigger", async () => {
    for (const key of Object.keys(App.triggers)) {
      const rows = await appTester(App.triggers[key].operation.performList, { authData });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].id).toBeTruthy();
    }
  });

  liveTest("find_contact searches by email", async () => {
    const rows = await appTester(App.searches.find_contact.operation.perform, {
      authData,
      inputData: { email: "no-such-contact@example.com" },
    });
    expect(Array.isArray(rows)).toBe(true);
  });

  liveTest("create actions round-trip (needs a write key)", async () => {
    const contact = await appTester(App.creates.create_contact.operation.perform, {
      authData,
      inputData: { email: "zapier-test@example.com", name: "Zapier Test", roles: ["donor"] },
    });
    expect(contact.id).toBeTruthy();

    const donation = await appTester(App.creates.record_donation.operation.perform, {
      authData,
      inputData: { amount: 5, donor_name: "Zapier Test", method: "online" },
    });
    expect(donation.created).toBe(true);

    const animal = await appTester(App.creates.create_animal.operation.perform, {
      authData,
      inputData: { name: "Zapier Test Friend", species: "dog" },
    });
    expect(animal.created).toBe(true);
  });
});
