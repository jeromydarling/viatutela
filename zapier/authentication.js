"use strict";

const { API } = require("./lib/base");

// Custom auth: the shelter pastes an API key from Settings → Integrations.
// Every request carries it as a Bearer token via the beforeRequest hook.
module.exports = {
  type: "custom",
  fields: [
    {
      key: "api_key",
      label: "API Key",
      required: true,
      type: "password",
      helpText:
        "In Tutela, go to **Settings → Integrations → API keys** and create a key. " +
        "Use a *read-only* key for triggers; create a *read + write* key if you also " +
        "want the create actions (contacts, donations, animals).",
    },
  ],
  test: {
    url: `${API}/me`,
  },
  connectionLabel: "{{org_name}}",
};
