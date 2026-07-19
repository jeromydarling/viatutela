"use strict";

const { API } = require("../lib/base");

module.exports = {
  key: "find_contact",
  noun: "Contact",
  display: {
    label: "Find Contact",
    description: "Looks up a contact by email address.",
  },
  operation: {
    inputFields: [{ key: "email", label: "Email", required: true }],
    perform: async (z, bundle) => {
      const resp = await z.request({
        url: `${API}/contacts`,
        params: { email: bundle.inputData.email, limit: 1 },
      });
      return resp.data.data || [];
    },
    sample: {
      id: "ct_sample000000000000000000",
      name: "Jordan Sample",
      email: "jordan@example.com",
      phone: null,
      address: null,
      roles: "donor",
      created_at: "2026-07-01 12:00:00",
    },
  },
};
