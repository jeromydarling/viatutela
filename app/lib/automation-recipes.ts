/**
 * The automation recipe library — ready-to-build Zapier/Make/n8n recipes
 * on top of Tutela's webhooks, REST API, and calendar feed.
 *
 * Shown in-app (with the shelter's real URLs alongside) and summarized in
 * the public automation guide. Recipes must only reference trigger
 * sources we actually ship: the five webhook events, the read API, or
 * the ICS shift feed — no vaporware.
 */

export type RecipeTrigger =
  | "application.created"
  | "adoption.created"
  | "donation.created"
  | "animal.created"
  | "volunteer.signup"
  | "api"
  | "calendar";

export interface Recipe {
  slug: string;
  title: string;
  category: "Adoptions" | "Donors" | "Volunteers" | "Marketing" | "Office";
  trigger: RecipeTrigger;
  apps: string[]; // the other end of the Zap
  what: string; // the one-line payoff
  steps: string[]; // concrete setup, assuming the shared catch-hook intro
}

export const TRIGGER_LABELS: Record<RecipeTrigger, string> = {
  "application.created": "New adoption application",
  "adoption.created": "Adoption completed",
  "donation.created": "Donation recorded",
  "animal.created": "New animal added",
  "volunteer.signup": "Volunteer shift signup",
  api: "Schedule + REST API",
  calendar: "Shift calendar feed",
};

export const RECIPES: Recipe[] = [
  // ------------------------------------------------------------- adoptions
  {
    slug: "application-to-slack",
    title: "Post every new application in Slack",
    category: "Adoptions",
    trigger: "application.created",
    apps: ["Slack"],
    what: "The whole team sees applications the second they arrive — no inbox refreshing.",
    steps: [
      "Zapier action: Slack → Send Channel Message, into your #adoptions channel.",
      "Message template: \"🐾 New application for {{animal_name}} from {{name}} ({{email}}) — interest: {{interest}}\".",
      "Turn on the Zap, then submit a test application from your own adoption page to see it land.",
    ],
  },
  {
    slug: "application-to-sheet",
    title: "Log applications in a Google Sheet",
    category: "Adoptions",
    trigger: "application.created",
    apps: ["Google Sheets"],
    what: "A running pipeline spreadsheet for adoption-team meetings — zero copy-paste.",
    steps: [
      "Make a sheet with columns: date, applicant, email, animal, interest.",
      "Zapier action: Google Sheets → Create Spreadsheet Row; map timestamp, name, email, animal_name, interest.",
      "Bonus: add a \"decision\" column your team fills in by hand at the weekly meeting.",
    ],
  },
  {
    slug: "application-to-trello",
    title: "Create a Trello card per applicant",
    category: "Adoptions",
    trigger: "application.created",
    apps: ["Trello", "Asana", "Notion"],
    what: "Applications become cards you drag through Screening → Home visit → Approved.",
    steps: [
      "Zapier action: Trello → Create Card in your \"Screening\" list (Asana tasks and Notion database rows work the same way).",
      "Card name: \"{{name}} → {{animal_name}}\"; description: email, phone, and interest fields.",
      "Move the card through your lists as the conversation progresses — the card is the checklist.",
    ],
  },
  {
    slug: "adoption-celebration",
    title: "Celebrate every adoption in Slack or Discord",
    category: "Adoptions",
    trigger: "adoption.created",
    apps: ["Slack", "Discord"],
    what: "A 🎉 message the moment a friend goes home — the best notification your team will ever get.",
    steps: [
      "Zapier action: Slack → Send Channel Message (or Discord → Send Channel Message via webhook).",
      "Template: \"🏡 {{animal_name}} is going home! Adopted by {{adopter_name}} on {{date}}.\"",
      "Point it at your all-team channel. Morale is a metric too.",
    ],
  },
  {
    slug: "adoption-outcomes-sheet",
    title: "Track outcomes for board reports",
    category: "Adoptions",
    trigger: "adoption.created",
    apps: ["Google Sheets", "Airtable"],
    what: "A live outcomes ledger your board and grant applications can always pull from.",
    steps: [
      "Zapier action: Google Sheets → Create Spreadsheet Row in an \"Outcomes\" sheet.",
      "Map date, animal_name, animal_id, adopter contact_id.",
      "Your monthly board number is now =COUNTA of this month's rows — done before the meeting starts.",
    ],
  },
  // ---------------------------------------------------------------- donors
  {
    slug: "donation-thankyou-task",
    title: "Handwritten-note tasks for big gifts",
    category: "Donors",
    trigger: "donation.created",
    apps: ["Todoist", "Trello", "Asana"],
    what: "Every gift over your threshold gets a personal thank-you task — automatically.",
    steps: [
      "Add a Zapier Filter step: only continue if amount is greater than 100 (pick your threshold).",
      "Action: Todoist → Create Task, \"Handwritten thank-you: {{donor_name}} gave ${{amount}}\", due in 3 days.",
      "Donor retention lives and dies on the thank-you. This makes forgetting impossible.",
    ],
  },
  {
    slug: "donation-ledger",
    title: "Mirror donations into your bookkeeping",
    category: "Donors",
    trigger: "donation.created",
    apps: ["Google Sheets", "QuickBooks Online"],
    what: "The treasurer's ledger fills itself in — reconciliation, not re-typing.",
    steps: [
      "Zapier action: Google Sheets → Create Spreadsheet Row (or QuickBooks Online → Create Sales Receipt).",
      "Map date, donor_name, email, amount, method.",
      "Tutela remains the source of truth; the mirror is for your accountant's workflow.",
    ],
  },
  {
    slug: "donor-to-newsletter",
    title: "Add donors to your newsletter audience",
    category: "Donors",
    trigger: "donation.created",
    apps: ["Mailchimp", "Buttondown", "Beehiiv"],
    what: "Donors who opted in flow straight into your update list while the gift is still warm.",
    steps: [
      "Zapier action: Mailchimp → Add/Update Subscriber, mapping email and donor_name.",
      "Add a Filter step so only donations with an email continue.",
      "Only add people who agreed to hear from you — a thank-you is welcome, a surprise list isn't.",
    ],
  },
  {
    slug: "donation-wins-channel",
    title: "Every donation pings the #wins channel",
    category: "Donors",
    trigger: "donation.created",
    apps: ["Slack"],
    what: "Fundraising momentum everyone can feel — especially during campaign weeks.",
    steps: [
      "Zapier action: Slack → Send Channel Message to #wins.",
      "Template: \"💚 ${{amount}} from {{donor_name}}\" — keep amounts private? Send to a staff-only channel instead.",
    ],
  },
  // ------------------------------------------------------------ volunteers
  {
    slug: "shift-confirmation-email",
    title: "Auto-confirm shift signups by email",
    category: "Volunteers",
    trigger: "volunteer.signup",
    apps: ["Gmail", "Outlook"],
    what: "Volunteers get an instant confirmation with the shift name and date.",
    steps: [
      "Zapier action: Gmail → Send Email.",
      "Subject: \"You're on: {{shift_title}}, {{shift_date}}\"; body thanks {{volunteer_name}} and lists what to bring.",
      "Note: the payload includes the volunteer's contact_id — pull their email from your People export, or keep a roster sheet the Zap can look up.",
    ],
  },
  {
    slug: "shift-signups-sheet",
    title: "Back up volunteer hours to a sheet",
    category: "Volunteers",
    trigger: "volunteer.signup",
    apps: ["Google Sheets"],
    what: "A second copy of volunteer hours for grant applications and insurance audits.",
    steps: [
      "Zapier action: Google Sheets → Create Spreadsheet Row.",
      "Map shift_date, shift_title, volunteer_name.",
      "Tutela already totals hours on the Volunteers page — this is the belt-and-suspenders copy grant reviewers love.",
    ],
  },
  {
    slug: "shifts-in-calendar",
    title: "Put every shift in Google or Apple Calendar",
    category: "Volunteers",
    trigger: "calendar",
    apps: ["Google Calendar", "Apple Calendar"],
    what: "The whole crew sees upcoming shifts in the calendar they already live in — no Zapier needed.",
    steps: [
      "Copy your shift calendar link from Settings → Integrations.",
      "Google Calendar: Other calendars → + → From URL → paste. Apple Calendar: File → New Calendar Subscription.",
      "New shifts appear automatically as the calendar refreshes. Share the link with your volunteer crew.",
    ],
  },
  {
    slug: "shift-slack-reminder",
    title: "Announce new signups in #volunteers",
    category: "Volunteers",
    trigger: "volunteer.signup",
    apps: ["Slack"],
    what: "Coordinators see coverage filling up in real time.",
    steps: [
      "Zapier action: Slack → Send Channel Message to #volunteers.",
      "Template: \"🙌 {{volunteer_name}} signed up for {{shift_title}} on {{shift_date}}\".",
    ],
  },
  // ------------------------------------------------------------- marketing
  {
    slug: "new-animal-social-draft",
    title: "Draft a social post for every new friend",
    category: "Marketing",
    trigger: "animal.created",
    apps: ["Buffer", "Later"],
    what: "New arrivals queue up as social drafts while the intake photo is still fresh.",
    steps: [
      "Add a Zapier Filter: only continue when is_public is 1 (skip friends you're not ready to show).",
      "Action: Buffer → Add to Queue, with \"Meet {{name}}! {{breed}} looking for a home → your adoption page link\".",
      "Leave it as a draft queue — a human picks the photo and presses go. Tutela's Marketing studio drafts the long-form version.",
    ],
  },
  {
    slug: "new-animal-discord",
    title: "Tell your Discord community about new arrivals",
    category: "Marketing",
    trigger: "animal.created",
    apps: ["Discord"],
    what: "Your most engaged supporters hear about new friends first — they're your fastest shares.",
    steps: [
      "Zapier action: Discord → Send Channel Message to #new-friends.",
      "Template: \"🐾 {{name}} ({{breed}}) just arrived — adoption page goes live soon!\"",
      "Filter on is_public = 1 if some intakes shouldn't be announced yet.",
    ],
  },
  {
    slug: "new-animal-partner-alert",
    title: "Alert partner rescues about specific intakes",
    category: "Marketing",
    trigger: "animal.created",
    apps: ["Gmail"],
    what: "Your breed-rescue and behavior-specialist partners hear about relevant intakes automatically.",
    steps: [
      "Add a Zapier Filter on species or breed (e.g. breed contains \"husky\").",
      "Action: Gmail → Send Email to the partner rescue's intake address with name, breed, and your contact info.",
      "One Zap per partner keeps the routing dead simple.",
    ],
  },
  // ----------------------------------------------------------------- office
  {
    slug: "weekly-intake-digest",
    title: "A Monday-morning digest built from the API",
    category: "Office",
    trigger: "api",
    apps: ["Zapier Schedule", "Gmail"],
    what: "Every Monday: how many friends arrived last week, straight to the director's inbox.",
    steps: [
      "Zapier trigger: Schedule → Every Week (Monday, 7am).",
      "Action: Webhooks by Zapier → GET, URL: your API base + /animals?since= last Monday, header Authorization: Bearer your-api-key.",
      "Action: Gmail → Send Email with the count and names from the response. This one's for the spreadsheet-lover on your board.",
    ],
  },
  {
    slug: "application-to-notion-crm",
    title: "Build a Notion or Airtable mini-CRM",
    category: "Office",
    trigger: "application.created",
    apps: ["Notion", "Airtable"],
    what: "Applicants, adopters, and donors accumulate in one flexible database you can slice any way.",
    steps: [
      "Zapier action: Notion → Create Database Item (or Airtable → Create Record).",
      "Map name, email, animal_name, and a \"source\" field set to \"application\".",
      "Clone the Zap for donation.created with source \"donor\" — same table, full supporter picture.",
    ],
  },
  {
    slug: "application-sms-oncall",
    title: "Text the on-call coordinator for urgent interest",
    category: "Office",
    trigger: "application.created",
    apps: ["SMS by Zapier"],
    what: "Applications for long-stay friends ping a phone, not just an inbox.",
    steps: [
      "Add a Zapier Filter: animal_name matches the friend you're pushing hardest for.",
      "Action: SMS by Zapier → Send SMS: \"Application for {{animal_name}} from {{name}}!\"",
      "Retire the Zap when they go home. (May every such Zap be short-lived.)",
    ],
  },
];

export const RECIPE_CATEGORIES = ["Adoptions", "Donors", "Volunteers", "Marketing", "Office"] as const;
