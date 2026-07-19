import { Form, Link } from "react-router";
import type { Route } from "./+types/website.media";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Media library — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const media = await env.DB.prepare(
    `SELECT id, r2_key, alt, created_at FROM media WHERE org_id = ? ORDER BY created_at DESC LIMIT 200`,
  ).bind(user.org_id).all<{ id: string; r2_key: string; alt: string; created_at: string }>();
  return { media: media.results };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));

  if (intent === "upload") {
    const file = f.get("file");
    const alt = String(f.get("alt") ?? "").trim();
    if (!alt) return { error: "Every photo needs a description (alt text) — it's how screen readers see." };
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
    if (file.size > 10 * 1024 * 1024) return { error: "Images need to be under 10MB." };
    const type = file.type || "image/jpeg";
    if (!type.startsWith("image/")) return { error: "That doesn't look like an image." };
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "jpg";
    const key = `orgs/${user.org_id}/site/${newId("m")}.${ext}`;
    await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
    await env.DB.prepare(`INSERT INTO media (id, org_id, r2_key, alt) VALUES (?, ?, ?, ?)`)
      .bind(newId("md"), user.org_id, key, alt)
      .run();
    return { ok: "Uploaded. Copy its URL into any image field." };
  }

  if (intent === "delete") {
    const item = await env.DB.prepare(`SELECT id, r2_key FROM media WHERE id = ? AND org_id = ?`)
      .bind(String(f.get("media_id")), user.org_id)
      .first<{ id: string; r2_key: string }>();
    if (item) {
      await env.DB.prepare(`DELETE FROM media WHERE id = ?`).bind(item.id).run();
      await env.MEDIA.delete(item.r2_key);
    }
    return { ok: "Removed." };
  }
  return null;
}

export default function MediaLibrary({ loaderData, actionData }: Route.ComponentProps) {
  const { media } = loaderData;
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link to="/app/website" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Website</Link>
        <h1 className="text-2xl font-display font-semibold">Media library</h1>
      </div>

      {(actionData?.ok || actionData?.error) && (
        <p className={`rounded-2xl px-4 py-2.5 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`} role="status">
          {actionData.error ?? actionData.ok}
        </p>
      )}

      <Form method="post" encType="multipart/form-data" className="rounded-blob bg-white shadow-soft p-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="intent" value="upload" />
        <label className="block text-sm font-semibold">
          Image
          <input type="file" name="file" accept="image/*" required className="block mt-1 text-sm" />
        </label>
        <label className="block text-sm font-semibold flex-1 min-w-48">
          Description (alt text) *
          <input name="alt" required placeholder="Biscuit rolling in the grass" className="mt-1 w-full rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none" />
        </label>
        <button className="rounded-full bg-sunflower px-5 py-2.5 text-sm font-display font-semibold shadow-soft">
          Upload
        </button>
      </Form>

      {media.length === 0 ? (
        <p className="rounded-blob bg-white shadow-soft p-10 text-center text-charcoal-soft">
          No photos yet — upload your first above.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {media.map((m) => (
            <div key={m.id} className="rounded-blob bg-white shadow-soft overflow-hidden">
              <img src={`/api/media/${m.r2_key}`} alt={m.alt} className="w-full h-40 object-cover" loading="lazy" />
              <div className="p-3 space-y-1.5">
                <p className="text-sm font-semibold truncate">{m.alt}</p>
                <input
                  readOnly
                  value={`/api/media/${m.r2_key}`}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg bg-cream px-2 py-1 text-[11px] text-charcoal-soft"
                  aria-label="Image URL — click to select and copy"
                />
                <Form method="post" onSubmit={(e) => { if (!confirm("Remove this photo?")) e.preventDefault(); }}>
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="media_id" value={m.id} />
                  <button className="text-xs font-semibold text-terracotta-deep hover:underline">remove</button>
                </Form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
