import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/import";
import { SiteHeader, SiteFooter } from "../components/site";
import { BirdDoodle, DogDoodle, HeartPawDoodle } from "../components/doodles";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Free Migration Importer — Via Tutela" },
    {
      name: "description",
      content:
        "Upload your shelter's messy CSV or Excel exports and get a clean, relationship-preserving import. Free, no account needed.",
    },
  ];
}

export default function ImportLanding() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function upload(files: FileList | File[]) {
    const list = [...files].filter((f) =>
      /\.(csv|xlsx|xls)$/i.test(f.name),
    );
    if (!list.length) {
      setError("We can read .csv and .xlsx files — try one of those.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of list) form.append("files", f);
      const res = await fetch("/api/import/upload", { method: "POST", body: form });
      const data = (await res.json()) as { job_id?: string; error?: string };
      if (!res.ok || !data.job_id) throw new Error(data.error || "Upload failed.");
      navigate(`/import/${data.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — please try again.");
      setUploading(false);
    }
  }

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
        <div className="text-center vt-fade-up">
          <h1 className="text-4xl sm:text-5xl font-display font-semibold">
            Move in free. <span className="text-meadow-deep">We'll carry the boxes.</span>
          </h1>
          <p className="mt-4 text-lg text-charcoal-soft max-w-2xl mx-auto">
            Upload the CSV or Excel exports from your current system — animals,
            contacts, medical records, adoptions. We'll untangle them, keep every
            relationship intact, and show you exactly what came in. No account
            needed.
          </p>
        </div>

        <div
          className={`mt-10 rounded-blob border-4 border-dashed p-12 text-center transition-colors cursor-pointer ${
            dragOver ? "border-meadow bg-meadow/10" : "border-sunflower bg-white"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          aria-label="Upload your export files"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
            }}
          />
          <DogDoodle className="w-24 h-24 mx-auto text-meadow-deep vt-float" />
          {uploading ? (
            <p className="mt-4 text-xl font-display font-semibold">
              Carrying your boxes in…
            </p>
          ) : (
            <>
              <p className="mt-4 text-xl font-display font-semibold">
                Drop your files here, or click to choose
              </p>
              <p className="mt-2 text-charcoal-soft">
                .csv or .xlsx — one file or several. Messy is fine; that's the point.
              </p>
            </>
          )}
        </div>
        {error && (
          <p className="mt-4 text-center font-semibold text-terracotta-deep" role="alert">
            {error}
          </p>
        )}

        <div className="mt-14 grid sm:grid-cols-3 gap-6 text-center">
          {[
            {
              title: "Relationships survive",
              body: "Adopters stay linked to their animals. Bonded pairs stay bonded. Medical history follows each friend home.",
            },
            {
              title: "Nothing gets lost",
              body: "Every row we can't confidently place lands in a downloadable report with a specific field and reason.",
            },
            {
              title: "Yours to keep — or not",
              body: "Try it with no account. Love the result? One click makes it your new home. Either way, your source files are never changed.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-blob bg-white shadow-soft p-6">
              <HeartPawDoodle className="w-10 h-10 mx-auto text-meadow" />
              <h2 className="mt-3 font-display font-semibold text-lg">{f.title}</h2>
              <p className="mt-2 text-sm text-charcoal-soft">{f.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-charcoal-soft">
          <BirdDoodle className="w-8 h-8 inline-block text-meadow-deep" /> Your
          data stays scoped to your browser session until you choose to keep it.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
