"use strict";

const { API } = require("../lib/base");

/**
 * All five Tutela triggers are REST hooks with the same shape:
 * subscribe → POST /v1/hooks, unsubscribe → DELETE /v1/hooks/:id,
 * live payload → the webhook's `data` object, samples → /v1/samples/:event.
 */
function restHookTrigger({ key, event, noun, label, description, sample }) {
  return {
    key,
    noun,
    display: { label, description },
    operation: {
      type: "hook",

      performSubscribe: {
        url: `${API}/hooks`,
        method: "POST",
        body: { url: "{{bundle.targetUrl}}", events: [event] },
      },

      performUnsubscribe: {
        url: `${API}/hooks/{{bundle.subscribeData.id}}`,
        method: "DELETE",
      },

      // A live delivery: {event, delivery_id, timestamp, data:{...}}
      perform: (z, bundle) => {
        const body = bundle.cleanedRequest || {};
        const data = body.data || {};
        return [{ ...data, event: body.event || event, received_at: body.timestamp || null }];
      },

      // Editor samples: real recent rows when they exist, canned otherwise.
      performList: async (z, bundle) => {
        const resp = await z.request({ url: `${API}/samples/${event}` });
        return (resp.data.data || []).map((row) => ({ ...row, event, received_at: null }));
      },

      sample: { ...sample, event, received_at: "2026-07-01T12:00:00.000Z" },
    },
  };
}

module.exports = { restHookTrigger };
