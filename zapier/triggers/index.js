"use strict";

const { restHookTrigger } = require("./factory");
const { SAMPLES } = require("../lib/samples");

const newApplication = restHookTrigger({
  key: "new_application",
  event: "application.created",
  noun: "Application",
  label: "New Adoption Application",
  description: "Fires the moment someone applies to adopt one of your friends.",
  sample: SAMPLES["application.created"],
});

const adoptionCompleted = restHookTrigger({
  key: "adoption_completed",
  event: "adoption.created",
  noun: "Adoption",
  label: "Adoption Completed",
  description: "Fires when a friend officially goes home.",
  sample: SAMPLES["adoption.created"],
});

const newDonation = restHookTrigger({
  key: "new_donation",
  event: "donation.created",
  noun: "Donation",
  label: "Donation Recorded",
  description: "Fires when a donation is recorded in Tutela.",
  sample: SAMPLES["donation.created"],
});

const newAnimal = restHookTrigger({
  key: "new_animal",
  event: "animal.created",
  noun: "Animal",
  label: "New Animal Added",
  description: "Fires when a new friend is added to your shelter.",
  sample: SAMPLES["animal.created"],
});

const volunteerSignup = restHookTrigger({
  key: "volunteer_signup",
  event: "volunteer.signup",
  noun: "Shift Signup",
  label: "Volunteer Shift Signup",
  description: "Fires when a volunteer signs up for a shift.",
  sample: SAMPLES["volunteer.signup"],
});

module.exports = { newApplication, adoptionCompleted, newDonation, newAnimal, volunteerSignup };
