import { Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/animal.detail";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { AnimalFields } from "./animal.new";
import { getAnthropic, logAiWrite } from "../../../workers/lib/ai";
import { compactAnimal, summarizeNotes, writeBio, type BioPack, type HandoffPack } from "../../../workers/lib/ai-shelter";
import { autoAdoption } from "../../../workers/lib/marketing-auto";
import { scheduleFollowups } from "../../../workers/lib/lifecycle";
import { extractVetRecords, fileToVisionImage, type OcrRecord, type VisionImage } from "../../../workers/lib/ai-vision";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.animal?.name ?? "Friend"} — Via Tutela` }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const animal = await env.DB.prepare(`SELECT * FROM animals WHERE id = ? AND org_id = ?`)
    .bind(params.animalId, user.org_id)
    .first<Record<string, unknown>>();
  if (!animal) throw new Response("Not found", { status: 404 });

  const [photos, medical, adoptions, fosters, contacts, locations, bonded] = await Promise.all([
    env.DB.prepare(`SELECT id, r2_key, kind FROM animal_photos WHERE animal_id = ? ORDER BY created_at`)
      .bind(animal.id).all<{ id: string; r2_key: string; kind: string }>(),
    env.DB.prepare(`SELECT * FROM medical_records WHERE animal_id = ? ORDER BY date DESC, created_at DESC`)
      .bind(animal.id).all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT ad.*, c.name contact_name FROM adoptions ad
       LEFT JOIN contacts c ON c.id = ad.contact_id WHERE ad.animal_id = ? ORDER BY ad.date DESC`,
    ).bind(animal.id).all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT fa.*, c.name contact_name FROM foster_assignments fa
       JOIN contacts c ON c.id = fa.contact_id WHERE fa.animal_id = ? ORDER BY fa.active DESC, fa.created_at DESC`,
    ).bind(animal.id).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT id, name, roles FROM contacts WHERE org_id = ? ORDER BY name LIMIT 500`)
      .bind(user.org_id).all<{ id: string; name: string; roles: string | null }>(),
    env.DB.prepare(`SELECT id, name FROM locations WHERE org_id = ? AND active = 1 ORDER BY name`)
      .bind(user.org_id).all<{ id: string; name: string }>(),
    animal.bonded_group_id
      ? env.DB.prepare(
          `SELECT id, name FROM animals WHERE org_id = ? AND bonded_group_id = ? AND id != ?`,
        ).bind(user.org_id, animal.bonded_group_id, animal.id).all<{ id: string; name: string }>()
      : Promise.resolve({ results: [] as { id: string; name: string }[] }),
  ]);

  return {
    animal,
    photos: photos.results,
    medical: medical.results,
    adoptions: adoptions.results,
    fosters: fosters.results,
    contacts: contacts.results,
    locations: locations.results,
    bonded: bonded.results,
    orgSlug: user.slug,
    aiReady: Boolean(getAnthropic(env)),
  };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const { env, ctx, user } = await requireUser(context, request);
  const animal = await env.DB.prepare(`SELECT id, status FROM animals WHERE id = ? AND org_id = ?`)
    .bind(params.animalId, user.org_id)
    .first<{ id: string; status: string }>();
  if (!animal) throw new Response("Not found", { status: 404 });

  const f = await request.formData();
  const intent = f.get("intent");
  const str = (k: string) => String(f.get(k) ?? "").trim() || null;

  if (intent === "update") {
    const name = str("name");
    if (!name) return { error: "Every friend needs a name." };
    const locationId = str("location_id");
    const validLocation = locationId
      ? await env.DB.prepare(`SELECT id FROM locations WHERE id = ? AND org_id = ?`)
          .bind(locationId, user.org_id)
          .first()
      : null;
    await env.DB.prepare(
      `UPDATE animals SET name=?, species=?, breed=?, sex=?, dob=?, altered=?, microchip=?,
         status=?, description=?, kennel=?, color=?, weight=?, intake_date=?, is_public=?, location_id=?
       WHERE id=? AND org_id=?`,
    )
      .bind(
        name, str("species"), str("breed"), str("sex"), str("dob"),
        f.get("altered") === "" || f.get("altered") == null ? null : Number(f.get("altered")),
        str("microchip"), str("status") ?? "available", str("description"),
        str("kennel"), str("color"), str("weight"), str("intake_date"),
        f.get("is_public") ? 1 : 0,
        validLocation ? locationId : null,
        animal.id, user.org_id,
      )
      .run();
    return { ok: "Saved." };
  }

  if (intent === "upload-photo") {
    const file = f.get("photo");
    if (file instanceof File && file.size > 0) {
      const type = file.type || "image/jpeg";
      const isVideo = type.startsWith("video/");
      if (!isVideo && !type.startsWith("image/")) return { error: "That doesn't look like a photo or video." };
      if (isVideo && file.size > 50 * 1024 * 1024) return { error: "Videos need to be under 50MB — a 30-second clip is plenty." };
      if (!isVideo && file.size > 10 * 1024 * 1024) return { error: "Photos need to be under 10MB." };
      const ext = isVideo
        ? (type.includes("webm") ? "webm" : type.includes("quicktime") ? "mov" : "mp4")
        : (type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg");
      const key = `orgs/${user.org_id}/photos/${animal.id}-${newId("p")}.${ext}`;
      await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
      await env.DB.prepare(
        `INSERT INTO animal_photos (id, org_id, animal_id, r2_key, kind) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(newId("ph"), user.org_id, animal.id, key, isVideo ? "video" : "photo")
        .run();
      return { ok: isVideo ? "Video added — it'll play right on the adoption page. 🎬" : "Photo added." };
    }
    return { ok: "Nothing uploaded." };
  }

  if (intent === "delete-photo") {
    const photo = await env.DB.prepare(
      `SELECT id, r2_key FROM animal_photos WHERE id = ? AND org_id = ? AND animal_id = ?`,
    )
      .bind(str("photo_id"), user.org_id, animal.id)
      .first<{ id: string; r2_key: string }>();
    if (photo) {
      await env.DB.prepare(`DELETE FROM animal_photos WHERE id = ?`).bind(photo.id).run();
      await env.MEDIA.delete(photo.r2_key);
    }
    return { ok: "Photo removed." };
  }

  if (intent === "add-medical") {
    await env.DB.prepare(
      `INSERT INTO medical_records (id, org_id, animal_id, date, type, description, vet, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId("md"), user.org_id, animal.id, str("date"), str("type"),
        str("description"), str("vet"), str("due_date"),
      )
      .run();
    return { ok: "Medical record added." };
  }

  if (intent === "delete-medical") {
    await env.DB.prepare(`DELETE FROM medical_records WHERE id = ? AND org_id = ? AND animal_id = ?`)
      .bind(str("record_id"), user.org_id, animal.id)
      .run();
    return { ok: "Record removed." };
  }

  if (intent === "assign-foster") {
    const contactId = str("contact_id");
    if (!contactId) return { error: "Pick a foster first." };
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO foster_assignments (id, org_id, animal_id, contact_id, start_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(newId("fa"), user.org_id, animal.id, contactId, str("start_date") ?? new Date().toISOString().slice(0, 10), str("notes")),
      env.DB.prepare(`UPDATE animals SET status = 'in foster' WHERE id = ?`).bind(animal.id),
    ]);
    return { ok: "Foster assigned." };
  }

  if (intent === "end-foster") {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE foster_assignments SET active = 0, end_date = date('now') WHERE id = ? AND org_id = ?`,
      ).bind(str("assignment_id"), user.org_id),
      env.DB.prepare(`UPDATE animals SET status = 'available' WHERE id = ? AND status = 'in foster'`).bind(animal.id),
    ]);
    return { ok: "Foster stay ended." };
  }

  if (intent === "record-adoption") {
    const contactId = str("contact_id");
    const adoptionId = newId("ad");
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO adoptions (id, org_id, animal_id, contact_id, date, fee, status)
         VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
      ).bind(
        adoptionId, user.org_id, animal.id, contactId,
        str("date") ?? new Date().toISOString().slice(0, 10),
        f.get("fee") ? Number(f.get("fee")) : null,
      ),
      env.DB.prepare(`UPDATE animals SET status = 'adopted' WHERE id = ?`).bind(animal.id),
      env.DB.prepare(
        `UPDATE foster_assignments SET active = 0, end_date = date('now') WHERE animal_id = ? AND active = 1`,
      ).bind(animal.id),
    ]);
    ctx.waitUntil(autoAdoption(env, user.org_id, String(animal.id)));
    ctx.waitUntil(scheduleFollowups(env, user.org_id, adoptionId));
    return { ok: "Welcome home! Adoption recorded — check-in emails are scheduled." };
  }

  if (intent === "ai-vet-ocr") {
    const images: VisionImage[] = [];
    for (const file of f.getAll("records")) {
      if (file instanceof File && file.size > 0) {
        const img = await fileToVisionImage(file);
        if (img) images.push(img);
        if (images.length >= 4) break;
      }
    }
    if (images.length === 0) return { error: "Add at least one photo of the records (jpg/png/webp, under 5MB)." };
    const res = await extractVetRecords(env, { orgId: user.org_id, images });
    if (res.error || !res.records) return { error: res.error ?? "Nothing came back." };
    if (res.records.length === 0) return { error: "No readable medical events found in those photos." };
    await logAiWrite(env, user.org_id, user.user_id, "vet_ocr", `animal ${animal.id}: ${res.records.length} rows`);
    return { ok: `${res.records.length} record${res.records.length === 1 ? "" : "s"} read — review below, then add them.`, ocr: res.records };
  }

  if (intent === "ai-vet-apply") {
    try {
      const records = JSON.parse(str("records_json") ?? "[]") as OcrRecord[];
      const stmts = records.slice(0, 40).map((r) =>
        env.DB.prepare(
          `INSERT INTO medical_records (id, org_id, animal_id, date, type, description, vet, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(newId("md"), user.org_id, animal.id, r.date, String(r.type).slice(0, 30), String(r.description).slice(0, 500), r.vet, r.due_date),
      );
      if (stmts.length) await env.DB.batch(stmts);
      return { ok: `${stmts.length} medical record${stmts.length === 1 ? "" : "s"} added to the timeline.` };
    } catch {
      return { error: "Couldn't apply those records — run the reader again." };
    }
  }

  if (intent === "ai-bio") {
    const full = await env.DB.prepare(`SELECT * FROM animals WHERE id = ?`).bind(animal.id).first<Record<string, unknown>>();
    const org = await env.DB.prepare(`SELECT name FROM orgs WHERE id = ?`).bind(user.org_id).first<{ name: string }>();
    const med = await env.DB.prepare(
      `SELECT type, description FROM medical_records WHERE animal_id = ? ORDER BY date DESC LIMIT 10`,
    ).bind(animal.id).all<{ type: string | null; description: string | null }>();
    const medicalNote = med.results.length
      ? med.results.map((m) => [m.type, m.description].filter(Boolean).join(": ")).join("; ").slice(0, 600)
      : null;
    const res = await writeBio(env, {
      animal: compactAnimal(full ?? {}),
      facts: String(f.get("facts") ?? ""),
      orgName: org?.name ?? "the rescue",
      medicalNote,
    });
    if (res.error || !res.pack) return { error: res.error ?? "The bio writer came back empty." };
    await logAiWrite(env, user.org_id, user.user_id, "bio_pack", `animal ${animal.id}`);
    return { ok: "Fresh copy below — use what you like.", bioPack: res.pack };
  }

  if (intent === "ai-bio-apply") {
    const bio = String(f.get("bio") ?? "").trim();
    if (!bio) return { error: "Nothing to apply." };
    await env.DB.prepare(`UPDATE animals SET description = ? WHERE id = ? AND org_id = ?`)
      .bind(bio.slice(0, 4000), animal.id, user.org_id)
      .run();
    return { ok: "Bio saved to the profile." };
  }

  if (intent === "ai-summary") {
    const full = await env.DB.prepare(`SELECT * FROM animals WHERE id = ?`).bind(animal.id).first<Record<string, unknown>>();
    const med = await env.DB.prepare(
      `SELECT date, type, description, vet, due_date FROM medical_records WHERE animal_id = ? ORDER BY date DESC LIMIT 60`,
    ).bind(animal.id).all<{ date: string | null; type: string | null; description: string | null; vet: string | null; due_date: string | null }>();
    const fosterRows = await env.DB.prepare(
      `SELECT notes FROM foster_assignments WHERE animal_id = ? AND notes IS NOT NULL AND notes != '' ORDER BY created_at DESC LIMIT 20`,
    ).bind(animal.id).all<{ notes: string }>();
    const res = await summarizeNotes(env, {
      animal: compactAnimal(full ?? {}),
      medical: med.results,
      fosterNotes: fosterRows.results.map((r) => r.notes),
    });
    if (res.error || !res.pack) return { error: res.error ?? "The summarizer came back empty." };
    await logAiWrite(env, user.org_id, user.user_id, "handoff_summary", `animal ${animal.id}`);
    return { ok: "Handoff summaries ready below.", handoff: res.pack };
  }

  if (intent === "delete-animal") {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM medical_records WHERE animal_id = ? AND org_id = ?`).bind(animal.id, user.org_id),
      env.DB.prepare(`DELETE FROM animal_photos WHERE animal_id = ? AND org_id = ?`).bind(animal.id, user.org_id),
      env.DB.prepare(`DELETE FROM foster_assignments WHERE animal_id = ? AND org_id = ?`).bind(animal.id, user.org_id),
      env.DB.prepare(`DELETE FROM adoptions WHERE animal_id = ? AND org_id = ?`).bind(animal.id, user.org_id),
      env.DB.prepare(`DELETE FROM tasks WHERE animal_id = ? AND org_id = ?`).bind(animal.id, user.org_id),
      env.DB.prepare(`DELETE FROM applications WHERE animal_id = ? AND org_id = ?`).bind(animal.id, user.org_id),
      env.DB.prepare(`DELETE FROM animals WHERE id = ? AND org_id = ?`).bind(animal.id, user.org_id),
    ]);
    return redirect("/app/animals");
  }

  return null;
}

const inputCls =
  "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

export default function AnimalDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { animal, photos, medical, adoptions, fosters, contacts, locations, bonded, orgSlug, aiReady } = loaderData;
  const nav = useNavigation();
  const activeFoster = fosters.find((fa) => fa.active);
  const ai = actionData as { bioPack?: BioPack; handoff?: HandoffPack; ocr?: OcrRecord[] } | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/animals" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">
            ← All friends
          </Link>
          <h1 className="text-3xl font-display font-semibold">{String(animal.name)}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className="rounded-full bg-sky/20 text-sky-deep px-2 py-1">{String(animal.status)}</span>
            {Boolean(animal.kennel) && (
              <span className="rounded-full bg-sunflower-soft px-2 py-1">kennel {String(animal.kennel)}</span>
            )}
            {bonded.map((b) => (
              <Link key={b.id} to={`/app/animals/${b.id}`} className="rounded-full bg-terracotta/20 text-terracotta-deep px-2 py-1 hover:underline">
                bonded with {b.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/app/animals/${animal.id}/card`}
            className="rounded-full border-2 border-meadow px-4 py-2 text-sm font-display font-semibold text-meadow-deep hover:bg-meadow hover:text-white transition-colors"
          >
            Kennel QR card
          </Link>
          {Boolean(animal.is_public) && (
            <Link
              to={`/adopt/${orgSlug}/${animal.id}`}
              className="rounded-full border-2 border-sky px-4 py-2 text-sm font-display font-semibold text-sky-deep hover:bg-sky hover:text-white transition-colors"
            >
              Public page ↗
            </Link>
          )}
        </div>
      </div>

      {(actionData?.ok || actionData?.error) && (
        <p
          className={`rounded-2xl px-4 py-3 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`}
          role="status"
        >
          {actionData.error ?? actionData.ok}
        </p>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* details */}
        <section className="lg:col-span-3 rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-xl">Details</h2>
          <Form method="post" className="mt-4">
            <input type="hidden" name="intent" value="update" />
            <AnimalFields animal={animal} locations={locations} />
            <button
              disabled={nav.state !== "idle"}
              className="mt-5 rounded-full bg-meadow text-white px-6 py-2.5 font-display font-semibold shadow-soft disabled:opacity-50"
            >
              Save changes
            </button>
          </Form>
        </section>

        <div className="lg:col-span-2 space-y-6">
          {/* photos */}
          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-xl">Photos</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative group">
                  {p.kind === "video" ? (
                    <video src={`/api/media/${p.r2_key}`} preload="metadata" muted className="w-full aspect-square object-cover rounded-xl bg-charcoal/80" />
                  ) : (
                    <img src={`/api/media/${p.r2_key}`} alt="" className="w-full aspect-square object-cover rounded-xl" />
                  )}
                  {p.kind === "video" && (
                    <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-1.5 text-xs">🎬</span>
                  )}
                  <Form method="post" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <input type="hidden" name="intent" value="delete-photo" />
                    <input type="hidden" name="photo_id" value={p.id} />
                    <button aria-label="Remove photo" className="w-6 h-6 rounded-full bg-white/90 text-terracotta-deep font-bold text-xs shadow">
                      ✕
                    </button>
                  </Form>
                </div>
              ))}
            </div>
            <Form method="post" encType="multipart/form-data" className="mt-3 flex gap-2 items-center">
              <input type="hidden" name="intent" value="upload-photo" />
              <input type="file" name="photo" accept="image/*,video/mp4,video/webm,video/quicktime" required className="text-sm flex-1 w-0" />
              <button className="rounded-full bg-sunflower px-4 py-2 text-sm font-semibold shadow-soft">
                Upload
              </button>
            </Form>
            <p className="mt-1 text-xs text-charcoal-soft">Photos up to 10MB · videos up to 50MB — a 30-second clip sells a personality better than ten photos.</p>
          </section>

          {/* foster */}
          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-xl">Foster care</h2>
            {activeFoster ? (
              <div className="mt-3">
                <p>
                  Staying with <strong>{String(activeFoster.contact_name)}</strong> since{" "}
                  {String(activeFoster.start_date ?? "—")}
                </p>
                <Form method="post" className="mt-3">
                  <input type="hidden" name="intent" value="end-foster" />
                  <input type="hidden" name="assignment_id" value={String(activeFoster.id)} />
                  <button className="rounded-full border-2 border-terracotta text-terracotta-deep px-4 py-2 text-sm font-semibold hover:bg-terracotta hover:text-white transition-colors">
                    End foster stay
                  </button>
                </Form>
              </div>
            ) : (
              <Form method="post" className="mt-3 space-y-2">
                <input type="hidden" name="intent" value="assign-foster" />
                <select name="contact_id" required className={`${inputCls} w-full`}>
                  <option value="">Choose a foster…</option>
                  {contacts.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name}{ct.roles?.includes("foster") ? " ★" : ""}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <input name="start_date" type="date" className={inputCls} />
                  <input name="notes" placeholder="Notes" className={`${inputCls} flex-1 min-w-32`} />
                </div>
                <button className="rounded-full bg-meadow text-white px-4 py-2 text-sm font-semibold">
                  Send to foster
                </button>
              </Form>
            )}
          </section>

          {/* adoption */}
          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-xl">Adoption</h2>
            {adoptions.length > 0 && (
              <ul className="mt-2 text-sm divide-y divide-cream">
                {adoptions.map((ad) => (
                  <li key={String(ad.id)} className="py-2">
                    {String(ad.date ?? "—")} — {String(ad.contact_name ?? "someone kind")}
                    {ad.fee != null && ` · $${ad.fee}`}
                  </li>
                ))}
              </ul>
            )}
            {String(animal.status) !== "adopted" && (
              <Form method="post" className="mt-3 space-y-2">
                <input type="hidden" name="intent" value="record-adoption" />
                <select name="contact_id" className={`${inputCls} w-full`}>
                  <option value="">Adopter (optional)…</option>
                  {contacts.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <input name="date" type="date" className={inputCls} />
                  <input name="fee" type="number" min="0" step="0.01" placeholder="Fee $" className={`${inputCls} w-28`} />
                </div>
                <button className="rounded-full bg-sunflower px-4 py-2 text-sm font-display font-semibold shadow-soft">
                  Record adoption 🏡
                </button>
              </Form>
            )}
          </section>
        </div>
      </div>

      {/* medical */}
      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-xl">Medical history</h2>
        <Form method="post" className="mt-3 flex flex-wrap gap-2 items-end">
          <input type="hidden" name="intent" value="add-medical" />
          <input name="date" type="date" aria-label="Date given" className={inputCls} />
          <input name="type" placeholder="vaccine, exam, surgery…" className={inputCls} />
          <input name="description" placeholder="Details" className={`${inputCls} flex-1 min-w-40`} />
          <input name="vet" placeholder="Vet / clinic" className={inputCls} />
          <label className="text-xs font-semibold text-charcoal-soft">
            next due
            <input name="due_date" type="date" className={`${inputCls} block mt-0.5`} />
          </label>
          <button className="rounded-full bg-meadow text-white px-4 py-2 text-sm font-semibold">Add</button>
        </Form>
        {aiReady && (
          <div className="mt-3 rounded-2xl border-2 border-sky/30 bg-sky/5 p-3">
            <Form method="post" encType="multipart/form-data" className="flex flex-wrap gap-2 items-center">
              <input type="hidden" name="intent" value="ai-vet-ocr" />
              <span className="text-sm font-semibold">✨ Paper records?</span>
              <input type="file" name="records" accept="image/jpeg,image/png,image/webp" multiple required className="text-sm flex-1 w-0 min-w-40" />
              <button disabled={nav.state !== "idle"} className="rounded-full bg-sky text-white px-4 py-1.5 text-sm font-semibold shadow-soft disabled:opacity-50">
                {nav.state !== "idle" ? "Reading…" : "Read them in"}
              </button>
            </Form>
            {ai?.ocr && ai.ocr.length > 0 && (
              <div className="mt-2">
                <ul className="text-sm space-y-1">
                  {ai.ocr.map((r, i) => (
                    <li key={i}>
                      <strong>{r.date ?? "no date"}</strong> · {r.type} — {r.description}
                      {r.vet && <span className="text-charcoal-soft"> ({r.vet})</span>}
                      {r.due_date && <span className="text-terracotta-deep font-semibold"> · due {r.due_date}</span>}
                    </li>
                  ))}
                </ul>
                <Form method="post" className="mt-2">
                  <input type="hidden" name="intent" value="ai-vet-apply" />
                  <input type="hidden" name="records_json" value={JSON.stringify(ai.ocr)} />
                  <button className="rounded-full bg-meadow text-white px-4 py-1.5 text-sm font-semibold shadow-soft">
                    Add all {ai.ocr.length} to the timeline
                  </button>
                </Form>
              </div>
            )}
          </div>
        )}
        {medical.length === 0 ? (
          <p className="mt-4 text-charcoal-soft">No records yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-charcoal-soft">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Details</th>
                  <th className="py-2 pr-4">Vet</th>
                  <th className="py-2 pr-4">Next due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {medical.map((m) => (
                  <tr key={String(m.id)} className="border-t border-cream">
                    <td className="py-2 pr-4 whitespace-nowrap">{String(m.date ?? "—")}</td>
                    <td className="py-2 pr-4">{String(m.type ?? "")}</td>
                    <td className="py-2 pr-4">{String(m.description ?? "")}</td>
                    <td className="py-2 pr-4">{String(m.vet ?? "")}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {m.due_date ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            String(m.due_date) <= new Date().toISOString().slice(0, 10)
                              ? "bg-terracotta/20 text-terracotta-deep"
                              : "bg-sunflower-soft"
                          }`}
                        >
                          {String(m.due_date)}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete-medical" />
                        <input type="hidden" name="record_id" value={String(m.id)} />
                        <button aria-label="Delete record" className="text-terracotta-deep font-bold text-xs">✕</button>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AI helpers */}
      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-xl">✨ AI helpers</h2>
        {!aiReady ? (
          <p className="mt-3 text-sm text-charcoal-soft">
            The AI helpers need an Anthropic API key on the Worker — once it's set, this section writes bios,
            Petfinder blurbs, social posts, and adopter/vet handoff summaries from {String(animal.name)}'s real records.
          </p>
        ) : (
          <div className="mt-4 grid lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-display font-semibold">Write the adoption bio</h3>
              <p className="text-xs text-charcoal-soft mt-0.5">
                A couple of quick facts in, a bio + Petfinder blurb + social post out. Nothing is saved until you apply it.
              </p>
              <Form method="post" className="mt-2 space-y-2">
                <input type="hidden" name="intent" value="ai-bio" />
                <textarea
                  name="facts"
                  rows={3}
                  maxLength={1500}
                  placeholder={`e.g. loves squeaky toys, sits for treats, shy for the first hour, great on leash`}
                  className={`${inputCls} w-full`}
                />
                <button disabled={nav.state !== "idle"} className="rounded-full bg-sky text-white px-5 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
                  {nav.state !== "idle" ? "Writing…" : "Write bio & blurbs"}
                </button>
              </Form>
              {ai?.bioPack && (
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Adoption bio</span>
                      <Form method="post">
                        <input type="hidden" name="intent" value="ai-bio-apply" />
                        <input type="hidden" name="bio" value={ai.bioPack.bio} />
                        <button className="rounded-full bg-meadow text-white px-3 py-1 text-xs font-semibold">
                          Use as profile bio
                        </button>
                      </Form>
                    </div>
                    <textarea readOnly defaultValue={ai.bioPack.bio} rows={6} className={`${inputCls} w-full mt-1`} onFocus={(e) => e.currentTarget.select()} />
                  </div>
                  <div>
                    <span className="font-semibold">Petfinder blurb</span>
                    <textarea readOnly defaultValue={ai.bioPack.petfinder_blurb} rows={3} className={`${inputCls} w-full mt-1`} onFocus={(e) => e.currentTarget.select()} />
                  </div>
                  <div>
                    <span className="font-semibold">Social post</span>
                    <textarea readOnly defaultValue={ai.bioPack.social_post} rows={2} className={`${inputCls} w-full mt-1`} onFocus={(e) => e.currentTarget.select()} />
                  </div>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-display font-semibold">Handoff summaries</h3>
              <p className="text-xs text-charcoal-soft mt-0.5">
                Turns the medical timeline and foster notes into a warm adopter summary and a clinical vet brief.
              </p>
              <Form method="post" className="mt-2">
                <input type="hidden" name="intent" value="ai-summary" />
                <button disabled={nav.state !== "idle"} className="rounded-full bg-sky text-white px-5 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
                  {nav.state !== "idle" ? "Summarizing…" : "Summarize for adopter & vet"}
                </button>
              </Form>
              {ai?.handoff && (
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <span className="font-semibold">For the new family</span>
                    <textarea readOnly defaultValue={ai.handoff.adopter_summary} rows={6} className={`${inputCls} w-full mt-1`} onFocus={(e) => e.currentTarget.select()} />
                  </div>
                  <div>
                    <span className="font-semibold">For their vet</span>
                    <textarea readOnly defaultValue={ai.handoff.vet_brief} rows={8} className={`${inputCls} w-full mt-1`} onFocus={(e) => e.currentTarget.select()} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* danger */}
      <section className="rounded-blob border-2 border-dashed border-terracotta/40 p-6">
        <Form
          method="post"
          onSubmit={(e) => {
            if (!confirm(`Remove ${animal.name} and all their records? This cannot be undone.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete-animal" />
          <button className="text-sm font-semibold text-terracotta-deep hover:underline">
            Remove {String(animal.name)} and all their records
          </button>
        </Form>
      </section>
    </div>
  );
}
