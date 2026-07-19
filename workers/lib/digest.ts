/**
 * Weekly care digest: every org with a public email gets a Monday summary
 * of vaccines/treatments due in the next 14 days (or overdue), so nothing
 * slips. Triggered by the cron in wrangler.jsonc.
 */

import { sendAppEmail } from "./email";

export async function sendMedicalDigests(env: Env, origin: string): Promise<number> {
  const orgs = await env.DB.prepare(
    `SELECT DISTINCT o.id, o.name, o.email FROM orgs o
     JOIN medical_records m ON m.org_id = o.id
     JOIN animals a ON a.id = m.animal_id
     WHERE o.email IS NOT NULL AND m.due_date IS NOT NULL
       AND m.due_date <= date('now', '+14 days')
       AND a.status NOT IN ('adopted','deceased','transferred')`,
  ).all<{ id: string; name: string; email: string }>();

  let sent = 0;
  for (const org of orgs.results) {
    const due = await env.DB.prepare(
      `SELECT m.due_date, m.type, m.description, a.name animal_name
       FROM medical_records m JOIN animals a ON a.id = m.animal_id
       WHERE m.org_id = ? AND m.due_date IS NOT NULL
         AND m.due_date <= date('now', '+14 days')
         AND a.status NOT IN ('adopted','deceased','transferred')
       ORDER BY m.due_date LIMIT 30`,
    )
      .bind(org.id)
      .all<{ due_date: string; type: string | null; description: string | null; animal_name: string }>();
    if (!due.results.length) continue;

    const today = new Date().toISOString().slice(0, 10);
    const lines = due.results.map((d) => {
      const flag = d.due_date <= today ? "OVERDUE" : d.due_date;
      return `${flag} — ${d.animal_name}: ${[d.type, d.description].filter(Boolean).join(", ") || "care due"}`;
    });

    const ok = await sendAppEmail(env, {
      to: org.email,
      subject: `This week's care reminders for ${org.name} 🩺`,
      heading: `${due.results.length} friend${due.results.length === 1 ? " is" : "s are"} due for care soon`,
      paragraphs: [
        "A gentle Monday nudge — these vaccines and treatments are coming up (or waiting):",
        ...lines,
        "Mark each one handled from your dashboard once it's done.",
      ],
      cta: { label: "Open your dashboard", url: `${origin}/app` },
    });
    if (ok) sent++;
  }
  return sent;
}
