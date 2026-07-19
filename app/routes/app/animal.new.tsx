import { Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/animal.new";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Add a friend — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  await requireUser(context, request);
  return null;
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
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
  return redirect(`/app/animals/${id}`);
}

export const animalFieldsClass =
  "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-3 py-2 focus:border-meadow outline-none";

export function AnimalFields({ animal }: { animal?: Record<string, unknown> }) {
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
        <span className="font-semibold text-sm">Kennel / location</span>
        <input name="kennel" defaultValue={v("kennel")} placeholder="K-12, Cat Room 2…" className={animalFieldsClass} />
      </label>
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

export default function NewAnimal({ actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  return (
    <div className="max-w-3xl">
      <Link to="/app/animals" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">
        ← All friends
      </Link>
      <h1 className="mt-2 text-2xl font-display font-semibold">Add a friend</h1>
      <Form method="post" className="mt-6 rounded-blob bg-white shadow-soft p-6">
        <AnimalFields />
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
