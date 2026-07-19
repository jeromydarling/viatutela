"use strict";

const { API } = require("../lib/base");

const createContact = {
  key: "create_contact",
  noun: "Contact",
  display: {
    label: "Find or Create Contact",
    description: "Finds a contact by email, or creates one. Roles merge; existing details are never overwritten.",
  },
  operation: {
    inputFields: [
      { key: "email", label: "Email", required: true },
      { key: "name", label: "Name", helpText: "Used only when creating a new contact." },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      {
        key: "roles",
        label: "Roles",
        choices: ["adopter", "foster", "volunteer", "donor", "newsletter"],
        list: true,
        helpText: "Roles to add to the contact.",
      },
    ],
    perform: async (z, bundle) => {
      const resp = await z.request({
        url: `${API}/contacts`,
        method: "POST",
        body: {
          email: bundle.inputData.email,
          name: bundle.inputData.name,
          phone: bundle.inputData.phone,
          address: bundle.inputData.address,
          roles: (bundle.inputData.roles || []).join(","),
        },
      });
      return resp.data;
    },
    sample: { id: "ct_sample000000000000000000", email: "jordan@example.com", name: "Jordan Sample", roles: "donor", created: true },
  },
};

const recordDonation = {
  key: "record_donation",
  noun: "Donation",
  display: {
    label: "Record Donation",
    description: "Records a donation (e.g. from your payment platform) so Tutela stays the source of truth.",
  },
  operation: {
    inputFields: [
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "donor_name", label: "Donor Name" },
      { key: "email", label: "Donor Email" },
      { key: "contact_id", label: "Contact ID", helpText: "Optional — link to an existing contact instead of donor name/email." },
      { key: "method", label: "Method", choices: ["cash", "check", "card", "online", "other"] },
      { key: "note", label: "Note" },
      { key: "date", label: "Date (YYYY-MM-DD)", helpText: "Defaults to today." },
    ],
    perform: async (z, bundle) => {
      const resp = await z.request({
        url: `${API}/donations`,
        method: "POST",
        body: bundle.inputData,
      });
      return resp.data;
    },
    sample: { id: "dn_sample000000000000000000", amount: 50, date: "2026-07-01", created: true },
  },
};

const createAnimal = {
  key: "create_animal",
  noun: "Animal",
  display: {
    label: "Add Animal",
    description: "Adds a new friend — handy for intake forms. Arrives unlisted (not public) unless you say otherwise.",
  },
  operation: {
    inputFields: [
      { key: "name", label: "Name", required: true },
      { key: "species", label: "Species", helpText: "e.g. dog, cat, rabbit" },
      { key: "breed", label: "Breed" },
      { key: "sex", label: "Sex", choices: ["male", "female"] },
      { key: "dob", label: "Date of Birth (YYYY-MM-DD)" },
      { key: "microchip", label: "Microchip" },
      { key: "status", label: "Status", choices: ["available", "pending", "in foster", "hold"], default: "available" },
      { key: "description", label: "Description" },
      { key: "intake_date", label: "Intake Date (YYYY-MM-DD)", helpText: "Defaults to today." },
      { key: "is_public", label: "Show on adoption page?", type: "boolean", default: "false" },
    ],
    perform: async (z, bundle) => {
      const resp = await z.request({
        url: `${API}/animals`,
        method: "POST",
        body: bundle.inputData,
      });
      return resp.data;
    },
    sample: { id: "an_sample000000000000000000", name: "Biscuit", status: "available", created: true },
  },
};

module.exports = { createContact, recordDonation, createAnimal };
