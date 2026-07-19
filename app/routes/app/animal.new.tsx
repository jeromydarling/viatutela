import { aiAvailable } from "../../../workers/lib/ai-shelter";
import { Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/animal.new";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { autoNewAnimal } from "../../../workers/lib/marketing-auto";
import { notifyWaitlist } from "../../../workers/lib/waitlist";
import { getAnthropic, logAiWrite } from "../../../workers/lib/ai";
import { draftFromPhotos, fileToVisionImage, type IntakeDraft, type VisionImage } from "../../../workers/lib/ai-vision";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Add a friend — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const locations = await env.DB.prepare(
    `SELECT id, name FROM locations WHERE org_id = ? AND active = 1 ORDER BY name`,
  )
    .bind(user.org_id)
    .all<{ id: string; name: string }>();
  return { locations: locations.results, aiReady: aiAvailable(env) };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, ctx, user } = await requireUser(context, request);
  const f = await request.formData();

  if (String(f.get("intent")) === "ai-intake") {
    const images: VisionImage[] = [];
    for (const file of f.getAll("photos")) {
      if (file instanceof File && file.size > 0) {
        const img = await fileToVisionImage(file);
        if (img) images.push(img);
        if (images.length >= 4) break;
      }
    }
    if (images.length === 0) return { error: "Add at least one photo (jpg/png/webp, under 5MB)." };
    const res = await draftFromPhotos(env, { orgId: user.org_id, images, notes: String(f.get("notes") ?? "") });
    if (res.error || !res.draft) return { error: res.error ?? "No draft came back." };
    ctx.waitUntil(logAiWrite(env, user.org_id, user.user_id, "intake_vision", `${images.length} photos`));
    return { draft: res.draft, ok: "Draft below — check every guess before saving. Photos aren't stored here; add them on the profile after." };
  }

  const name = String(f.get("name") ?? "").trim();
  if (!name) return { error: "Every friend needs a name." };

  const id = newId("an");
  await env.DB.prepare(
    `INSERT INTO animals (id, org_id, name, species, breed, sex, dob, altered, microchip,
       status, description, kennel, color, weight, intake_date, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.org_id,
      name,
      String(f.get("species") || "") || null,
      String(f.get("breed") || "") || null,
      String(f.get("sex") || "") || null,
      String(f.get("dob") || "") || null,
      f.get("altered") === "" ? null : Number(f.get("altered")),
      String(f.get("microchip") || "") || null,
      String(f.get("status") || "available"),
      String(f.get("description") || "") || null,
      String(f.get("kennel") || "") || null,
      String(f.get("color") || "") || null,
      String(f.get("weight") || "") || null,
      String(f.get("intake_date") || "") || null,
      f.get("is_public") ? 1 : 0,
    )
    .run();
  const locationId = String(f.get("location_id") || "");
  if (locationId) {
    await env.DB.prepare(
      `UPDATE animals SET location_id = ? WHERE id = ? AND ? IN (SELECT id FROM locations WHERE org_id = ?)`,
    )
      .bind(locationId, id, locationId, user.org_id)
      .run();
  }
  // off the request path: launch kit + waitlist alerts for new public friends
  ctx.waitUntil(autoNewAnimal(env, user.org_id, id));
  ctx.waitUntil(notifyWaitlist(env, user.org_id, id, new URL(request.url).origin));
  return redirect(`/app/animals/${id}`);
}

export const animalFieldsClass =
  "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-3 py-2 focus:border-meadow outline-none";

export function AnimalFields({
  animal,
  locations = [],
}: {
  animal?: Record<string, unknown>;
  locations?: { id: string; name: string }[];
}) {
  const v = (k: string) => (animal?.[k] as string | number | null | undefined) ?? "";
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <label className="block sm:col-span-2">
        <span className="font-semibold text-sm">Name *</span>
        <input name="name" required defaultValue={v("name")} className={animalFieldsClass} />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Species</span>
        <input name="species" defaultValue={v("species")} placeholder="dog, cat, rabbit…" className={animalFieldsClass} />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Breed</span>
        <input name="breed" defaultValue={v("breed")} className={animalFieldsClass} />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Sex</span>
        <select name="sex" defaultValue={v("sex")} className={animalFieldsClass}>
          <option value="">unknown</option>
          <option value="male">male</option>
          <option value="female">female</option>
        </select>
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Spayed / neutered</span>
        <select name="altered" defaultValue={animal ? String(v("altered") ?? "") : ""} className={animalFieldsClass}>
          <option value="">unknown</option>
          <option value="1">yes</option>
          <option value="0">not yet</option>
        </select>
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Date of birth</span>
        <input name="dob" type="date" defaultValue={v("dob")} className={animalFieldsClass} />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Intake date</span>
        <input name="intake_date" type="date" defaultValue={v("intake_date")} className={animalFieldsClass} />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Microchip</span>
        <input name="microchip" defaultValue={v("microchip")} className={animalFieldsClass} />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Status</span>
        <select name="status" defaultValue={v("status") || "available"} className={animalFieldsClass}>
          {["available", "pending", "adopted", "in foster", "medical hold", "transferred", "returned", "deceased"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Kennel</span>
        <input name="kennel" defaultValue={v("kennel")} placeholder="K-12, Cat Room 2…" className={animalFieldsClass} />
      </label>
      {locations.length > 0 && (
        <label className="block">
          <span className="font-semibold text-sm">Location</span>
          <select name="location_id" defaultValue={v("location_id")} className={animalFieldsClass}>
            <option value="">— no location —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="font-semibold text-sm">Color</span>
        <input name="color" defaultValue={v("color")} className={animalFieldsClass} />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Weight</span>
        <input name="weight" defaultValue={v("weight")} placeholder="42 lbs" className={animalFieldsClass} />
      </label>
      <label className="block sm:col-span-2">
        <span className="font-semibold text-sm">Bio / notes</span>
        <textarea name="description" rows={3} defaultValue={v("description")} className={animalFieldsClass} />
      </label>
      <label className="flex items-center gap-2 sm:col-span-2 font-semibold text-sm">
        <input
          type="checkbox"
          name="is_public"
          defaultChecked={animal ? Boolean(animal.is_public) : true}
          className="w-4 h-4 accent-[#4caf7d]"
        />
        Show on your public adoption page
      </label>
    </div>
  );
}

export default function NewAnimal({ loaderData, actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  const ai = actionData as { draft?: IntakeDraft; ok?: string; error?: string } | undefined;
  const prefill = ai?.draft
    ? {
        name: ai.draft.suggested_name,
        species: ai.draft.species,
        breed: ai.draft.breed_guess,
        sex: ["male", "female"].includes(ai.draft.sex_guess) ? ai.draft.sex_guess : "",
        color: ai.draft.color,
        weight: ai.draft.weight_guess,
        description: `${ai.draft.bio}\n\n(Estimated age: ${ai.draft.estimated_age} — AI intake draft, staff-verified)`,
      }
    : undefined;
  return (
    <div className="max-w-3xl">
      <Link to="/app/animals" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">
        ← All friends
      </Link>
      <h1 className="mt-2 text-2xl font-display font-semibold">Add a friend</h1>

      {loaderData.aiReady && (
        <section className="mt-4 rounded-blob border-2 border-sky/40 bg-sky/5 p-5">
          <h2 className="font-display font-semibold">✨ Draft from intake photos</h2>
          <p className="text-xs text-charcoal-soft mt-0.5">
            Snap a few photos, add a note, and the form below prefills — species, markings, a first bio. Every guess is yours to correct.
          </p>
          <Form method="post" encType="multipart/form-data" className="mt-2 flex flex-wrap gap-2 items-center">
            <input type="hidden" name="intent" value="ai-intake" />
            <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required className="text-sm flex-1 w-0 min-w-40" />
            <input name="notes" placeholder="Quick note (found where, temperament…)" className="flex-1 min-w-40 rounded-xl border-2 border-cream bg-white px-3 py-2 text-sm focus:border-meadow outline-none" />
            <button disabled={nav.state !== "idle"} className="rounded-full bg-sky text-white px-5 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
              {nav.state !== "idle" ? "Looking…" : "Draft the profile"}
            </button>
          </Form>
          {ai?.ok && <p className="mt-2 text-sm font-semibold text-meadow-deep">{ai.ok}</p>}
        </section>
      )}

      <Form method="post" key={prefill ? "prefilled" : "blank"} className="mt-6 rounded-blob bg-white shadow-soft p-6">
        <AnimalFields animal={prefill} locations={loaderData.locations} />
        {actionData?.error && (
          <p className="mt-4 font-semibold text-terracotta-deep" role="alert">{actionData.error}</p>
        )}
        <button
          disabled={nav.state !== "idle"}
          className="mt-6 rounded-full bg-meadow text-white px-6 py-3 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
        >
          {nav.state !== "idle" ? "Making up the bed…" : "Welcome them in"}
        </button>
      </Form>
    </div>
  );
}
