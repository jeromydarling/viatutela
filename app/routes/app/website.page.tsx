import { Form, Link } from "react-router";
import type { Route } from "./+types/website.page";
import { requireUser } from "../../lib/auth.server";
import { newToken } from "../../../workers/lib/ids";
import {
  SECTION_DEFS,
  SECTION_DEF_BY_TYPE,
  parseSectionsJson,
  validateSections,
  type Section,
  type SectionType,
} from "../../../workers/lib/site-sections";
import { draftMeta, rewriteText, logAiWrite } from "../../../workers/lib/ai";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `Edit ${data?.page?.title ?? "page"} — Via Tutela` }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const page = await env.DB.prepare(`SELECT * FROM pages WHERE id = ? AND org_id = ?`)
    .bind(params.pageId, user.org_id)
    .first<Record<string, string | null>>();
  if (!page) throw new Response("Not found", { status: 404 });
  const media = await env.DB.prepare(
    `SELECT id, r2_key, alt FROM media WHERE org_id = ? ORDER BY created_at DESC LIMIT 100`,
  ).bind(user.org_id).all<{ id: string; r2_key: string; alt: string }>();
  return {
    page,
    sections: parseSectionsJson(page.sections),
    media: media.results,
    slug: user.slug,
  };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const page = await env.DB.prepare(`SELECT * FROM pages WHERE id = ? AND org_id = ?`)
    .bind(params.pageId, user.org_id)
    .first<Record<string, string | null>>();
  if (!page) throw new Response("Not found", { status: 404 });

  const f = await request.formData();
  const intent = String(f.get("intent"));
  const sections = parseSectionsJson(page.sections);

  const saveSections = async (next: Section[]) => {
    const v = validateSections(next);
    if (!v.ok) return { error: v.error };
    await env.DB.prepare(`UPDATE pages SET sections = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(JSON.stringify(v.sections), page.id)
      .run();
    return null;
  };

  if (intent === "save-page") {
    const title = String(f.get("title") ?? "").trim();
    if (!title) return { error: "The page needs a title." };
    await env.DB.prepare(
      `UPDATE pages SET title=?, subtitle=?, layout=?, hero_image_url=?, hero_eyebrow=?,
         meta_title=?, meta_description=?, body_md=?, updated_at=datetime('now') WHERE id=?`,
    )
      .bind(
        title,
        String(f.get("subtitle") ?? "").trim() || null,
        ["standard", "hero", "wide"].includes(String(f.get("layout"))) ? String(f.get("layout")) : "standard",
        String(f.get("hero_image_url") ?? "").trim() || null,
        String(f.get("hero_eyebrow") ?? "").trim() || null,
        String(f.get("meta_title") ?? "").trim() || null,
        String(f.get("meta_description") ?? "").trim() || null,
        String(f.get("body_md") ?? "").trim() || null,
        page.id,
      )
      .run();
    return { ok: "Page saved." };
  }

  if (intent === "publish" || intent === "unpublish") {
    const publishAt = String(f.get("publish_at") ?? "").trim() || null;
    await env.DB.prepare(
      `UPDATE pages SET status = ?, publish_at = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(intent === "publish" ? "published" : "draft", intent === "publish" ? publishAt : null, page.id)
      .run();
    return {
      ok:
        intent === "publish"
          ? publishAt && publishAt > new Date().toISOString()
            ? `Scheduled — goes live ${publishAt.slice(0, 16).replace("T", " at ")}.`
            : "Published. It's live."
          : "Back to draft.",
    };
  }

  if (intent === "make-preview") {
    const token = newToken();
    await env.CONFIG.put(`preview:${token}`, String(page.id), { expirationTtl: 7 * 24 * 3600 });
    const origin = new URL(request.url).origin;
    const path = page.slug === "home" ? `/s/${user.slug}` : `/s/${user.slug}/${page.slug}`;
    return { preview: `${origin}${path}?preview=${token}` };
  }

  if (intent === "add-section") {
    const type = String(f.get("type")) as SectionType;
    if (!SECTION_DEF_BY_TYPE[type]) return { error: "Unknown section type." };
    const err = await saveSections([...sections, { type }]);
    return err ?? { ok: `${SECTION_DEF_BY_TYPE[type].label} added at the bottom.` };
  }

  const idx = Number(f.get("index"));
  if (["delete-section", "move-section", "update-section"].includes(intent)) {
    if (!isFinite(idx) || idx < 0 || idx >= sections.length) return { error: "That section moved — reload and try again." };
  }

  if (intent === "delete-section") {
    const next = sections.filter((_, i) => i !== idx);
    return (await saveSections(next)) ?? { ok: "Section removed." };
  }

  if (intent === "move-section") {
    const dir = String(f.get("dir")) === "up" ? -1 : 1;
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return null;
    const next = [...sections];
    [next[idx], next[j]] = [next[j], next[idx]];
    return (await saveSections(next)) ?? { ok: "Moved." };
  }

  if (intent === "ai-rewrite") {
    const i = Number(f.get("index"));
    const mode = String(f.get("mode") ?? "warmer");
    const section = sections[i];
    if (!section || section.type !== "prose" || typeof section.md !== "string" || !section.md.trim()) {
      return { error: "Nothing to rewrite in that section yet — write a first draft, then let the AI polish it." };
    }
    const result = await rewriteText(env, section.md, mode);
    if (result.error || !result.text) return { error: result.error ?? "Rewrite failed." };
    const next = [...sections];
    next[i] = { ...section, md: result.text };
    const saveErr = await saveSections(next);
    if (saveErr) return saveErr;
    await logAiWrite(env, user.org_id, user.user_id, "rewrite", `page=${page.slug} section=${i} mode=${mode}`);
    return { ok: `Rewritten ${mode === "shorter" ? "shorter" : mode} — saved. Not what you wanted? Rewrite again or edit by hand.` };
  }

  if (intent === "ai-meta") {
    const summary = [
      page.title,
      page.subtitle ?? "",
      ...sections.map((s) => Object.values(s).filter((v) => typeof v === "string").join(" ")),
    ].join("\n");
    const result = await draftMeta(env, String(page.title), user.org_name, summary);
    if (result.error || !result.meta_title) return { error: result.error ?? "Meta drafting failed." };
    await env.DB.prepare(
      `UPDATE pages SET meta_title = ?, meta_description = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(result.meta_title, result.meta_description ?? null, page.id)
      .run();
    await logAiWrite(env, user.org_id, user.user_id, "meta", `page=${page.slug}`);
    return { ok: "SEO title & description drafted — check them in Page settings." };
  }

  if (intent === "update-section") {
    const def = SECTION_DEF_BY_TYPE[sections[idx].type];
    const updated: Section = { type: sections[idx].type };
    for (const field of def.fields) {
      const raw = String(f.get(`f.${field.name}`) ?? "").trim();
      if (!raw) continue;
      updated[field.name] = field.kind === "number" ? Number(raw) : raw;
    }
    if (def.items) {
      const count = Number(f.get("item_count") ?? 0);
      const list: Record<string, unknown>[] = [];
      for (let i = 0; i < count && i < 60; i++) {
        if (f.get(`item.${i}._remove`)) continue;
        const item: Record<string, unknown> = {};
        let has = false;
        for (const field of def.items.fields) {
          const raw = String(f.get(`item.${i}.${field.name}`) ?? "").trim();
          if (raw) {
            item[field.name] = raw;
            has = true;
          }
        }
        if (has) list.push(item);
      }
      // the always-present blank "add one more" row
      {
        const item: Record<string, unknown> = {};
        let has = false;
        for (const field of def.items.fields) {
          const raw = String(f.get(`new_item.${field.name}`) ?? "").trim();
          if (raw) {
            item[field.name] = raw;
            has = true;
          }
        }
        if (has) list.push(item);
      }
      updated.items = list;
    }
    const next = [...sections];
    next[idx] = updated;
    return (await saveSections(next)) ?? { ok: "Section saved." };
  }

  return null;
}

const inputCls =
  "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none w-full";

function Field({
  field,
  value,
  namePrefix,
  media,
}: {
  field: { name: string; label: string; kind: string; options?: string[]; placeholder?: string };
  value: unknown;
  namePrefix: string;
  media: { r2_key: string; alt: string }[];
}) {
  const v = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const name = `${namePrefix}${field.name}`;
  if (field.kind === "textarea") {
    return (
      <label className="block text-sm">
        <span className="font-semibold">{field.label}</span>
        <textarea name={name} defaultValue={v} rows={4} placeholder={field.placeholder} className={`${inputCls} mt-1`} />
      </label>
    );
  }
  if (field.kind === "select") {
    return (
      <label className="block text-sm">
        <span className="font-semibold">{field.label}</span>
        <select name={name} defaultValue={v} className={`${inputCls} mt-1`}>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
    );
  }
  if (field.kind === "image") {
    return (
      <label className="block text-sm">
        <span className="font-semibold">{field.label}</span>
        <input name={name} defaultValue={v} list="media-urls" placeholder="Paste an image URL or pick from your library" className={`${inputCls} mt-1`} />
        {media.length === 0 && (
          <span className="text-xs text-charcoal-soft">Tip: upload photos in the media library first.</span>
        )}
      </label>
    );
  }
  return (
    <label className="block text-sm">
      <span className="font-semibold">{field.label}</span>
      <input name={name} type={field.kind === "number" ? "number" : "text"} defaultValue={v} placeholder={field.placeholder} className={`${inputCls} mt-1`} />
    </label>
  );
}

export default function PageEditor({ loaderData, actionData: rawActionData }: Route.ComponentProps) {
  const { page, sections, media, slug } = loaderData;
  const actionData = rawActionData as { ok?: string; error?: string; preview?: string } | undefined;
  const viewPath = page.slug === "home" ? `/s/${slug}` : `/s/${slug}/${page.slug}`;

  return (
    <div className="max-w-4xl space-y-6">
      <datalist id="media-urls">
        {media.map((m) => (
          <option key={m.id} value={`/api/media/${m.r2_key}`}>{m.alt}</option>
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/app/website" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Website</Link>
          <h1 className="text-2xl font-display font-semibold">
            {String(page.title)} <span className="text-sm font-body text-charcoal-soft">/{String(page.slug)}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${page.status === "published" ? "bg-meadow/20 text-meadow-deep" : "bg-sunflower-soft"}`}>
            {String(page.status)}
          </span>
          <a href={viewPath} className="rounded-full border-2 border-sky px-4 py-1.5 text-sm font-display font-semibold text-sky-deep hover:bg-sky hover:text-white transition-colors">
            View ↗
          </a>
        </div>
      </div>

      {(actionData?.ok || actionData?.error) && (
        <p className={`rounded-2xl px-4 py-2.5 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`} role="status">
          {actionData.error ?? actionData.ok}
        </p>
      )}
      {actionData?.preview && (
        <p className="rounded-2xl bg-sky/15 px-4 py-2.5 text-sm font-semibold break-all">
          Share this draft: <a href={actionData.preview} className="text-sky-deep underline">{actionData.preview}</a>
          <span className="block text-xs text-charcoal-soft font-normal">Anyone with the link can view for 7 days — no account needed.</span>
        </p>
      )}

      {/* publish controls */}
      <section className="rounded-blob bg-white shadow-soft p-5 flex flex-wrap items-end gap-3">
        {page.status === "published" ? (
          <Form method="post">
            <input type="hidden" name="intent" value="unpublish" />
            <button className="rounded-full border-2 border-terracotta text-terracotta-deep px-5 py-2 text-sm font-semibold hover:bg-terracotta hover:text-white transition-colors">
              Unpublish
            </button>
          </Form>
        ) : (
          <Form method="post" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="intent" value="publish" />
            <button className="rounded-full bg-meadow text-white px-6 py-2.5 text-sm font-display font-semibold shadow-soft">
              Publish
            </button>
            <label className="text-xs font-semibold text-charcoal-soft">
              …or schedule for
              <input type="datetime-local" name="publish_at" className={`${inputCls} mt-0.5 w-52`} />
            </label>
          </Form>
        )}
        <Form method="post">
          <input type="hidden" name="intent" value="make-preview" />
          <button className="rounded-full border-2 border-sky text-sky-deep px-5 py-2 text-sm font-semibold hover:bg-sky hover:text-white transition-colors">
            Get a preview link
          </button>
        </Form>
        <Form method="post">
          <input type="hidden" name="intent" value="ai-meta" />
          <button className="rounded-full border-2 border-sunflower px-5 py-2 text-sm font-semibold hover:bg-sunflower-soft transition-colors">
            ✨ Draft SEO meta
          </button>
        </Form>
      </section>

      {/* page settings */}
      <details className="rounded-blob bg-white shadow-soft p-5">
        <summary className="font-display font-semibold cursor-pointer">Page settings & SEO</summary>
        <Form method="post" className="mt-4 grid sm:grid-cols-2 gap-3">
          <input type="hidden" name="intent" value="save-page" />
          <label className="block text-sm"><span className="font-semibold">Title</span>
            <input name="title" required defaultValue={String(page.title)} className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-sm"><span className="font-semibold">Subtitle</span>
            <input name="subtitle" defaultValue={String(page.subtitle ?? "")} className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-sm"><span className="font-semibold">Layout</span>
            <select name="layout" defaultValue={String(page.layout)} className={`${inputCls} mt-1`}>
              <option value="standard">standard</option>
              <option value="hero">hero</option>
              <option value="wide">wide</option>
            </select>
          </label>
          <label className="block text-sm"><span className="font-semibold">Social/hero image URL</span>
            <input name="hero_image_url" defaultValue={String(page.hero_image_url ?? "")} list="media-urls" className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-sm"><span className="font-semibold">SEO title</span>
            <input name="meta_title" defaultValue={String(page.meta_title ?? "")} className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-sm"><span className="font-semibold">SEO description</span>
            <input name="meta_description" defaultValue={String(page.meta_description ?? "")} className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-sm sm:col-span-2"><span className="font-semibold">Simple text (markdown, shown after sections)</span>
            <textarea name="body_md" rows={3} defaultValue={String(page.body_md ?? "")} className={`${inputCls} mt-1`} />
          </label>
          <input type="hidden" name="hero_eyebrow" value={String(page.hero_eyebrow ?? "")} />
          <div className="sm:col-span-2">
            <button className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-semibold">Save settings</button>
          </div>
        </Form>
      </details>

      {/* sections */}
      <h2 className="font-display font-semibold text-lg">Sections</h2>
      {sections.length === 0 && (
        <p className="text-sm text-charcoal-soft">No sections yet — add your first one below.</p>
      )}
      <div className="space-y-4">
        {sections.map((section, i) => {
          const def = SECTION_DEF_BY_TYPE[section.type];
          const sectionItems = Array.isArray(section.items) ? (section.items as Record<string, unknown>[]) : [];
          return (
            <details key={`${i}-${section.type}`} className="rounded-blob bg-white shadow-soft p-5">
              <summary className="cursor-pointer flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold">{i + 1}. {def.label}</span>
                <span className="text-xs text-charcoal-soft">{def.hint}</span>
                <span className="flex-1" />
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="move-section" />
                  <input type="hidden" name="index" value={i} />
                  <button name="dir" value="up" disabled={i === 0} aria-label="Move up" className="px-1.5 text-charcoal-soft disabled:opacity-30">↑</button>
                  <button name="dir" value="down" disabled={i === sections.length - 1} aria-label="Move down" className="px-1.5 text-charcoal-soft disabled:opacity-30">↓</button>
                </Form>
                <Form method="post" className="inline" onSubmit={(e) => { if (!confirm("Remove this section?")) e.preventDefault(); }}>
                  <input type="hidden" name="intent" value="delete-section" />
                  <input type="hidden" name="index" value={i} />
                  <button aria-label="Delete section" className="px-1.5 text-terracotta-deep font-bold">✕</button>
                </Form>
              </summary>
              <Form method="post" className="mt-4 space-y-3">
                <input type="hidden" name="intent" value="update-section" />
                <input type="hidden" name="index" value={i} />
                <div className="grid sm:grid-cols-2 gap-3">
                  {def.fields.map((field) => (
                    <div key={field.name} className={field.kind === "textarea" ? "sm:col-span-2" : ""}>
                      <Field field={field} value={section[field.name]} namePrefix="f." media={media} />
                    </div>
                  ))}
                </div>
                {def.items && (
                  <div className="rounded-2xl bg-cream/60 p-4 space-y-4">
                    <input type="hidden" name="item_count" value={sectionItems.length} />
                    <p className="text-sm font-semibold">{def.label} — each {def.items.label}:</p>
                    {sectionItems.map((it, ii) => (
                      <fieldset key={ii} className="rounded-xl bg-white p-3 space-y-2">
                        <div className="grid sm:grid-cols-2 gap-2">
                          {def.items!.fields.map((field) => (
                            <div key={field.name} className={field.kind === "textarea" ? "sm:col-span-2" : ""}>
                              <Field field={field} value={it[field.name]} namePrefix={`item.${ii}.`} media={media} />
                            </div>
                          ))}
                        </div>
                        <label className="text-xs font-semibold text-terracotta-deep">
                          <input type="checkbox" name={`item.${ii}._remove`} className="mr-1 accent-[#e07a5f]" />
                          remove this {def.items!.label}
                        </label>
                      </fieldset>
                    ))}
                    <fieldset className="rounded-xl bg-white/70 border-2 border-dashed border-sunflower p-3">
                      <p className="text-xs font-semibold text-charcoal-soft mb-2">Add a {def.items.label} (fill in and save)</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {def.items.fields.map((field) => (
                          <div key={field.name} className={field.kind === "textarea" ? "sm:col-span-2" : ""}>
                            <Field field={field} value="" namePrefix="new_item." media={media} />
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                )}
                <button className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-semibold">
                  Save section
                </button>
              </Form>
              {section.type === "prose" && (
                <Form method="post" className="mt-2 flex items-center gap-2 text-xs">
                  <input type="hidden" name="intent" value="ai-rewrite" />
                  <input type="hidden" name="index" value={i} />
                  <span className="font-semibold text-charcoal-soft">✨ AI rewrite:</span>
                  {["warmer", "punchier", "shorter"].map((mode) => (
                    <button
                      key={mode}
                      name="mode"
                      value={mode}
                      className="rounded-full border-2 border-sunflower px-3 py-1 font-semibold hover:bg-sunflower-soft transition-colors"
                    >
                      {mode}
                    </button>
                  ))}
                </Form>
              )}
            </details>
          );
        })}
      </div>

      <Form method="post" className="rounded-blob bg-white shadow-soft p-5 flex flex-wrap items-center gap-2">
        <input type="hidden" name="intent" value="add-section" />
        <span className="font-display font-semibold text-sm">Add a section:</span>
        <select name="type" className={`${inputCls} w-auto`}>
          {SECTION_DEFS.map((d) => (
            <option key={d.type} value={d.type}>{d.label}</option>
          ))}
        </select>
        <button className="rounded-full bg-sunflower px-5 py-2 text-sm font-display font-semibold shadow-soft">
          Add
        </button>
      </Form>
    </div>
  );
}
