"use strict";

const { version: platformVersion } = require("zapier-platform-core");
const { version } = require("./package.json");

const authentication = require("./authentication");
const triggers = require("./triggers");
const creates = require("./creates");
const findContact = require("./searches/findContact");

// Every request carries the connected key as a Bearer token.
const addBearer = (request, z, bundle) => {
  if (bundle.authData.api_key) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${bundle.authData.api_key}`;
  }
  return request;
};

// Surface Tutela's friendly error messages instead of generic HTTP noise.
const surfaceErrors = (response, z) => {
  if (response.status >= 400) {
    let message = `Request failed (HTTP ${response.status}).`;
    try {
      const body = JSON.parse(response.content);
      if (body && body.error) message = body.error;
    } catch {
      // keep the generic message
    }
    if (response.status === 401) throw new z.errors.RefreshAuthError(message);
    if (response.status === 429) throw new z.errors.ThrottledError(message, 60);
    throw new z.errors.Error(message, "TutelaAPIError", response.status);
  }
  return response;
};

module.exports = {
  version,
  platformVersion,

  authentication,
  beforeRequest: [addBearer],
  afterResponse: [surfaceErrors],

  triggers: {
    [triggers.newApplication.key]: triggers.newApplication,
    [triggers.adoptionCompleted.key]: triggers.adoptionCompleted,
    [triggers.newDonation.key]: triggers.newDonation,
    [triggers.newAnimal.key]: triggers.newAnimal,
    [triggers.volunteerSignup.key]: triggers.volunteerSignup,
  },

  searches: {
    [findContact.key]: findContact,
  },

  creates: {
    [creates.createContact.key]: creates.createContact,
    [creates.recordDonation.key]: creates.recordDonation,
    [creates.createAnimal.key]: creates.createAnimal,
  },
};
