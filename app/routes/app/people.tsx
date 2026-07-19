import { Form, useSearchParams } from "react-router";
import type { Route } from "./+types/people";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";

export function meta(_: Route.MetaArgs) {
  return [{ title: "People — Tutela" }];
}

const ROLE_OPTIONS = ["adopter", "foster", "volunteer", "donor", "staff", "vet"];

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const role = url.searchParams.get("role") ?? "";

  let sql = `SELECT c.*,
    (SELECT COUNT(*) FROM adoptions ad WHERE ad.contact_id = c.id) adoption_count,
    (SELECT COUNT(*) FROM foster_assignments fa WHERE fa.contact_id = c.id AND fa.active = 1) active_fosters,
    (SELECT COALESCE(SUM(amount),0) FROM donations d WHERE d.contact_id = c.id) donated
    FROM contacts c WHERE c.org_id = ?`;
  const binds: unknown[] = [user.org_id];
  if (q) {
    sql += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`;
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (role) {
    sql += ` AND c.roles LIKE ?`;
    binds.push(`%${role}%`);
  }
  sql += ` ORDER BY c.name LIMIT 500`;
  const contacts = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
  return { contacts: contacts.results };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = f.get("intent");
  const str = (k: string) => String(f.get(k) ?? "").trim() || null;

  if (intent === "add") {
    const name = str("name");
    if (!name) return { error: "A name, please." };
    const roles = ROLE_OPTIONS.filter((r) => f.getAll("roles").includes(r)).join(",") || null;
    await env.DB.prepare(
      `INSERT INTO contacts (id, org_id, name, email, phone, address, roles)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId("ct"), user.org_id, name, str("email"), str("phone"), str("address"), roles)
      .run();
    return { ok: `${name} added.` };
  }

  if (intent === "update") {
    const id = str("contact_id");
    const name = str("name");
    if (!id || !name) return { error: "A name, please." };
    const roles = ROLE_OPTIONS.filter((r) => f.getAll("roles").includes(r)).join(",") || null;
    await env.DB.prepare(
      `UPDATE contacts SET name=?, email=?, phone=?, address=?, roles=? WHERE id=? AND org_id=?`,
    )
      .bind(name, str("email"), str("phone"), str("address"), roles, id, user.org_id)
      .run();
    return { ok: "Saved." };
  }

  if (intent === "delete") {
    await env.DB.prepare(`DELETE FROM contacts WHERE id = ? AND org_id = ?`)
      .bind(str("contact_id"), user.org_id)
      .run();
    return { ok: "Removed." };
  }
  return null;
}

const inputCls =
  "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

function RoleChecks({ defaults }: { defaults?: string | null }) {
  const set = new Set((defaults ?? "").split(","));
  return (
    <div className="flex flex-wrap gap-2">
      {ROLE_OPTIONS.map((r) => (
        <label key={r} className="flex items-center gap-1 text-xs font-semibold">
          <input type="checkbox" name="roles" value={r} defaultChecked={set.has(r)} className="accent-[#4caf7d]" />
          {r}
        </label>
      ))}
    </div>
  );
}

export default function People({ loaderData, actionData }: Route.ComponentProps) {
  const { contacts } = loaderData;
  const [params] = useSearchParams();

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold">People ({contacts.length})</h1>

      {(actionData?.ok || actionData?.error) && (
        <p className={`mt-3 rounded-2xl px-4 py-2.5 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`}>
          {actionData.error ?? actionData.ok}
        </p>
      )}

      <div className="mt-4 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Form method="get" className="flex flex-wrap gap-2">
            <input name="q" defaultValue={params.get("q") ?? ""} placeholder="Search people…" className={`${inputCls} flex-1 min-w-36 bg-white`} />
            <select name="role" defaultValue={params.get("role") ?? ""} className={`${inputCls} bg-white`}>
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button className="rounded-full bg-meadow text-white px-4 font-semibold text-sm">Filter</button>
          </Form>

          <div className="mt-4 space-y-3">
            {contacts.length === 0 && (
              <p className="text-charcoal-soft rounded-blob bg-white shadow-soft p-8 text-center">
                No people yet — add your first friend-of-friends on the right.
              </p>
            )}
            {contacts.map((c) => (
              <details key={String(c.id)} className="rounded-blob bg-white shadow-soft p-4">
                <summary className="cursor-pointer flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold">{String(c.name)}</span>
                  <span className="text-sm text-charcoal-soft">{String(c.email ?? "")}</span>
                  <span className="flex-1" />
                  {(String(c.roles ?? "")).split(",").filter(Boolean).map((r) => (
                    <span key={r} className="rounded-full bg-sky/20 text-sky-deep text-xs font-semibold px-2 py-0.5">{r}</span>
                  ))}
                  {Number(c.active_fosters) > 0 && (
                    <span className="rounded-full bg-meadow/20 text-meadow-deep text-xs font-semibold px-2 py-0.5">fostering now</span>
                  )}
                  {Number(c.donated) > 0 && (
                    <span className="rounded-full bg-sunflower-soft text-xs font-semibold px-2 py-0.5">${Number(c.donated).toLocaleString()} given</span>
                  )}
                </summary>
                <Form method="post" className="mt-4 grid sm:grid-cols-2 gap-3">
                  <input type="hidden" name="contact_id" value={String(c.id)} />
                  <input name="name" defaultValue={String(c.name)} required className={inputCls} />
                  <input name="email" type="email" defaultValue={String(c.email ?? "")} placeholder="Email" className={inputCls} />
                  <input name="phone" defaultValue={String(c.phone ?? "")} placeholder="Phone" className={inputCls} />
                  <input name="address" defaultValue={String(c.address ?? "")} placeholder="Address" className={inputCls} />
                  <div className="sm:col-span-2">
                    <RoleChecks defaults={String(c.roles ?? "")} />
                  </div>
                  <div className="sm:col-span-2 flex gap-3">
                    <button name="intent" value="update" className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-semibold">Save</button>
                    <button
                      name="intent"
                      value="delete"
                      formNoValidate
                      onClick={(e) => {
                        if (!confirm(`Remove ${c.name}?`)) e.preventDefault();
                      }}
                      className="text-sm font-semibold text-terracotta-deep hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </Form>
              </details>
            ))}
          </div>
        </div>

        <div>
          <Form method="post" className="rounded-blob bg-white shadow-soft p-6 space-y-3 sticky top-32">
            <input type="hidden" name="intent" value="add" />
            <h2 className="font-display font-semibold text-lg">Add a person</h2>
            <input name="name" required placeholder="Full name *" className={`${inputCls} w-full`} />
            <input name="email" type="email" placeholder="Email" className={`${inputCls} w-full`} />
            <input name="phone" placeholder="Phone" className={`${inputCls} w-full`} />
            <input name="address" placeholder="Address" className={`${inputCls} w-full`} />
            <RoleChecks />
            <button className="rounded-full bg-sunflower px-5 py-2.5 font-display font-semibold shadow-soft w-full">
              Add person
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
