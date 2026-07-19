"use strict";

// BASE_URL is overridable so `npm test` can run against a local dev server.
const BASE_URL = process.env.BASE_URL || "https://viatutela.pet";
const API = `${BASE_URL}/api/v1`;

module.exports = { BASE_URL, API };
