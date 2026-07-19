"use strict";

// Mirrors SAMPLE_EVENTS in workers/lib/integrations.ts — keep in sync.
const SAMPLES = {
  "application.created": {
    id: "ap_sample000000000000000000",
    animal_id: "an_sample000000000000000000",
    animal_name: "Biscuit",
    name: "Jordan Sample",
    email: "jordan@example.com",
    interest: "adopt",
  },
  "adoption.created": {
    id: "ad_sample000000000000000000",
    animal_id: "an_sample000000000000000000",
    animal_name: "Biscuit",
    contact_id: "ct_sample000000000000000000",
    adopter_name: "Jordan Sample",
    date: "2026-07-01",
  },
  "donation.created": {
    id: "dn_sample000000000000000000",
    contact_id: null,
    donor_name: "Jordan Sample",
    email: "jordan@example.com",
    amount: 50,
    method: "online",
    date: "2026-07-01",
  },
  "animal.created": {
    id: "an_sample000000000000000000",
    name: "Biscuit",
    species: "dog",
    breed: "beagle mix",
    status: "available",
    is_public: 1,
  },
  "volunteer.signup": {
    id: "sg_sample000000000000000000",
    shift_id: "sh_sample000000000000000000",
    shift_title: "Morning kennels & walks",
    shift_date: "2026-07-01",
    contact_id: "ct_sample000000000000000000",
    volunteer_name: "Jordan Sample",
  },
};

module.exports = { SAMPLES };
