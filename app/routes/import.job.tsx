import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/import.job";
import { SiteHeader, SiteFooter } from "../components/site";
import { BirdDoodle, CatDoodle, HeartPawDoodle } from "../components/doodles";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Your import — Via Tutela" }];
}

// ---------- types mirrored from the API ----------

interface JobFileInfo {
  file_id: string;
  kind: string;
  name: string;
  size: number;
  format: string;
  headers: string[];
  mapping: Record<string, string | null>;
  status: string;
  canonical_fields: string[];
}

interface JobInfo {
  job: { id: string; status: string; rows_total: number; rows_ok: number; rows_flagged: number };
  files: JobFileInfo[];
}

interface PreviewRow {
  row_num: number;
  record: Record<string, unknown>;
  issues: { field: string; reason: string }[];
  ok: boolean;
}

interface Progress {
  status: string;
  stage: string;
  currentFile: string | null;
  rowsTotal: number;
  rowsOk: number;
  rowsFlagged: number;
  photosOk: number;
  photosFailed: number;
  error: string | null;
}

interface Summary {
  staged: {
    animals: number;
    contacts: number;
    medical: number;
    adoptions: number;
    bonded_groups: number;
    photos: number;
  };
  sample_animals: { name: string; species: string | null; breed: string | null }[];
}

const KINDS = ["animals", "contacts", "medical", "adoptions"] as const;
const KIND_LABELS: Record<string, string> = {
  animals: "Animals",
  contacts: "People & contacts",
  medical: "Medical records",
  adoptions: "Adoptions",
};

export default function ImportJob({ params }: Route.ComponentProps) {
  const jobId = params.jobId;
  const [info, setInfo] = useState<JobInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"mapping" | "processing" | "done" | "claimed">("mapping");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/import/${jobId}`);
    if (!res.ok) {
      setError(
        res.status === 404
          ? "We couldn't find this import in your session. It may have expired — start a fresh one, it only takes a minute."
          : "Something went wrong loading your import.",
      );
      return null;
    }
    const data = (await res.json()) as JobInfo;
    setInfo(data);
    const s = data.job.status;
    if (s === "processing") setPhase("processing");
    else if (s === "done" || s === "failed") setPhase("done");
    else if (s === "claimed") setPhase("claimed");
    else setPhase("mapping");
    return data;
  }, [jobId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        {error ? (
          <div className="text-center py-20">
            <CatDoodle className="w-24 h-24 mx-auto text-terracotta-deep" />
            <p className="mt-4 text-lg font-semibold">{error}</p>
            <Link
              to="/import"
              className="inline-block mt-6 rounded-full bg-sunflower px-6 py-3 font-display font-semibold shadow-soft"
            >
              Start a new import
            </Link>
          </div>
        ) : !info ? (
          <p className="text-center py-20 font-display text-xl">Fetching your friends…</p>
        ) : phase === "mapping" ? (
          <MappingPhase jobId={jobId} info={info} onProcessed={() => setPhase("processing")} />
        ) : phase === "processing" ? (
          <ProcessingPhase jobId={jobId} onDone={() => refresh()} />
        ) : (
          <ResultsPhase jobId={jobId} info={info} claimed={phase === "claimed"} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

// ================= mapping =================

function MappingPhase({
  jobId,
  info,
  onProcessed,
}: {
  jobId: string;
  info: JobInfo;
  onProcessed: () => void;
}) {
  const [files, setFiles] = useState<JobFileInfo[]>(info.files);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveMapping(file: JobFileInfo, mapping: Record<string, string | null>, kind: string) {
    setFiles((fs) =>
      fs.map((f) => (f.file_id === file.file_id ? { ...f, mapping, kind } : f)),
    );
    await fetch(`/api/import/${jobId}/files/${file.file_id}/mapping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping, kind }),
    });
  }

  async function process() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/import/${jobId}/process`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not start processing.");
      onProcessed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start processing.");
      setBusy(false);
    }
  }

  const readable = files.filter((f) => f.status !== "error");

  return (
    <div className="vt-fade-up">
      <h1 className="text-3xl sm:text-4xl font-display font-semibold text-center">
        Let's check the labels on these boxes
      </h1>
      <p className="mt-3 text-center text-charcoal-soft max-w-2xl mx-auto">
        We've guessed what each column means. Adjust anything we got wrong — the
        preview below each file shows exactly how your records will come in.
      </p>

      <div className="mt-10 space-y-10">
        {files.map((file) => (
          <FileMapper key={file.file_id} jobId={jobId} file={file} onSave={saveMapping} />
        ))}
      </div>

      <div className="mt-10 text-center">
        {error && (
          <p className="mb-4 font-semibold text-terracotta-deep" role="alert">
            {error}
          </p>
        )}
        <button
          onClick={process}
          disabled={busy || !readable.length}
          className="rounded-full bg-meadow px-8 py-4 font-display font-semibold text-lg text-white shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
        >
          {busy ? "Opening the doors…" : "Looks right — bring them home"}
        </button>
        <p className="mt-3 text-sm text-charcoal-soft">
          Your original files are never changed. We only read them.
        </p>
      </div>
    </div>
  );
}

function FileMapper({
  jobId,
  file,
  onSave,
}: {
  jobId: string;
  file: JobFileInfo;
  onSave: (file: JobFileInfo, mapping: Record<string, string | null>, kind: string) => Promise<void>;
}) {
  const [kind, setKind] = useState(file.kind);
  const [mapping, setMapping] = useState(file.mapping);
  const [preview, setPreview] = useState<{ fields: string[]; rows: PreviewRow[] } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadPreview = useCallback(async () => {
    const res = await fetch(`/api/import/${jobId}/files/${file.file_id}/preview`);
    if (res.ok) setPreview((await res.json()) as { fields: string[]; rows: PreviewRow[] });
  }, [jobId, file.file_id]);

  useEffect(() => {
    if (file.status !== "error") loadPreview();
  }, [loadPreview, file.status]);

  function update(mappingNext: Record<string, string | null>, kindNext: string) {
    setMapping(mappingNext);
    setKind(kindNext);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await onSave(file, mappingNext, kindNext);
      loadPreview();
    }, 500);
  }

  if (file.status === "error") {
    return (
      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-xl">{file.name}</h2>
        <p className="mt-2 text-terracotta-deep font-semibold">
          We couldn't read this file. It won't be included — everything else still will be.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-blob bg-white shadow-soft p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display font-semibold text-xl">{file.name}</h2>
        <label className="flex items-center gap-2 font-semibold text-sm">
          This file contains
          <select
            value={kind}
            onChange={(e) => {
              // re-suggesting server-side would be nicer; for now keep mapping keys, values validated server-side
              update(mapping, e.target.value);
            }}
            className="rounded-xl border-2 border-sunflower bg-cream px-3 py-1.5 font-semibold"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="text-sm w-full min-w-[560px]">
          <thead>
            <tr className="text-left text-charcoal-soft">
              <th className="py-2 pr-4 font-semibold">Your column</th>
              <th className="py-2 font-semibold">Becomes</th>
            </tr>
          </thead>
          <tbody>
            {file.headers.map((h) => (
              <tr key={h} className="border-t border-cream">
                <td className="py-2 pr-4 font-semibold">{h}</td>
                <td className="py-2">
                  <select
                    value={mapping[h] ?? ""}
                    onChange={(e) => update({ ...mapping, [h]: e.target.value || null }, kind)}
                    className={`rounded-xl border-2 px-3 py-1.5 ${
                      mapping[h] ? "border-meadow bg-meadow/10" : "border-cream bg-cream text-charcoal-soft"
                    }`}
                  >
                    <option value="">— skip this column —</option>
                    {file.canonical_fields.map((f) => (
                      <option key={f} value={f}>
                        {f.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview && preview.rows.length > 0 && (
        <details className="mt-4" open>
          <summary className="cursor-pointer font-display font-semibold">
            Preview — first {preview.rows.length} rows, normalized
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="text-xs w-full min-w-[640px]">
              <thead>
                <tr className="text-left bg-cream">
                  <th className="p-2">row</th>
                  {preview.fields.map((f) => (
                    <th key={f} className="p-2">{f.replace(/_/g, " ")}</th>
                  ))}
                  <th className="p-2">needs attention</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row_num} className={r.issues.length ? "bg-sunflower-soft/50" : ""}>
                    <td className="p-2 text-charcoal-soft">{r.row_num}</td>
                    {preview.fields.map((f) => (
                      <td key={f} className="p-2">
                        {r.record[f] === undefined
                          ? ""
                          : Array.isArray(r.record[f])
                            ? `${(r.record[f] as unknown[]).length} photo(s)`
                            : String(r.record[f])}
                      </td>
                    ))}
                    <td className="p-2 text-terracotta-deep">
                      {r.issues.map((i) => i.reason).join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

// ================= processing =================

function ProcessingPhase({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const handle = (p: Progress) => {
      setProgress(p);
      if ((p.status === "done" || p.status === "failed") && !doneRef.current) {
        doneRef.current = true;
        setTimeout(onDone, 800);
      }
    };

    try {
      es = new EventSource(`/api/import/${jobId}/progress`);
      es.onmessage = (e) => handle(JSON.parse(e.data) as Progress);
      es.onerror = () => {
        es?.close();
        es = null;
        if (!poll && !doneRef.current) {
          poll = setInterval(async () => {
            const res = await fetch(`/api/import/${jobId}/progress`);
            if (res.ok) handle((await res.json()) as Progress);
          }, 1500);
        }
      };
    } catch {
      // EventSource unavailable — poll
      poll = setInterval(async () => {
        const res = await fetch(`/api/import/${jobId}/progress`);
        if (res.ok) handle((await res.json()) as Progress);
      }, 1500);
    }

    return () => {
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [jobId, onDone]);

  const stageLabel: Record<string, string> = {
    rows: progress?.currentFile
      ? `Reading ${progress.currentFile}`
      : "Reading your records",
    bond: "Reuniting bonded pairs",
    photos: "Carrying photos across",
    done: "Welcome home",
    failed: "Something went wrong",
  };

  return (
    <div className="text-center py-16 vt-fade-up">
      <BirdDoodle className="w-24 h-24 mx-auto text-meadow-deep vt-float" />
      <h1 className="mt-6 text-3xl font-display font-semibold">
        {stageLabel[progress?.stage ?? "rows"] ?? "Working…"}
      </h1>
      <div className="mt-8 max-w-md mx-auto">
        <div className="h-4 rounded-full bg-cream overflow-hidden shadow-inner" role="progressbar" aria-label="Import progress">
          <div
            className="h-full bg-meadow transition-all duration-500"
            style={{
              width:
                progress?.stage === "done"
                  ? "100%"
                  : progress?.stage === "photos"
                    ? "85%"
                    : progress?.stage === "bond"
                      ? "70%"
                      : progress && progress.rowsTotal > 0
                        ? `${Math.min(65, 10 + progress.rowsTotal / 100)}%`
                        : "8%",
            }}
          />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <Stat label="rows read" value={progress?.rowsTotal ?? 0} />
          <Stat label="came in clean" value={progress?.rowsOk ?? 0} />
          <Stat label="flagged" value={progress?.rowsFlagged ?? 0} />
        </div>
        {(progress?.photosOk ?? 0) + (progress?.photosFailed ?? 0) > 0 && (
          <p className="mt-4 text-sm text-charcoal-soft">
            {progress?.photosOk} photo(s) re-homed{progress?.photosFailed ? `, ${progress.photosFailed} couldn't be fetched` : ""}
          </p>
        )}
        {progress?.error && (
          <p className="mt-4 font-semibold text-terracotta-deep" role="alert">
            {progress.error}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white shadow-soft p-3">
      <div className="text-2xl font-display font-bold">{value.toLocaleString()}</div>
      <div className="text-xs font-semibold text-charcoal-soft">{label}</div>
    </div>
  );
}

// ================= results =================

function ResultsPhase({
  jobId,
  info,
  claimed,
}: {
  jobId: string;
  info: JobInfo;
  claimed: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const failed = info.job.status === "failed";

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/import/${jobId}/summary`);
      if (res.ok) setSummary((await res.json()) as Summary);
    })();
  }, [jobId]);

  if (failed) {
    return (
      <div className="text-center py-16">
        <CatDoodle className="w-24 h-24 mx-auto text-terracotta-deep" />
        <h1 className="mt-4 text-3xl font-display font-semibold">
          That one got tangled in the leash
        </h1>
        <p className="mt-3 text-charcoal-soft">
          Something went wrong while processing. Your files are untouched — you
          can try again, or start a fresh import.
        </p>
        <Link
          to="/import"
          className="inline-block mt-6 rounded-full bg-sunflower px-6 py-3 font-display font-semibold shadow-soft"
        >
          Start over
        </Link>
      </div>
    );
  }

  return (
    <div className="vt-fade-up">
      <div className="text-center">
        <HeartPawDoodle className="w-20 h-20 mx-auto text-meadow" />
        <h1 className="mt-4 text-3xl sm:text-4xl font-display font-semibold">
          Welcome home. Every one of them made it across safely.
        </h1>
        <p className="mt-3 text-charcoal-soft">
          {info.job.rows_ok.toLocaleString()} rows came in clean
          {info.job.rows_flagged > 0 &&
            ` · ${info.job.rows_flagged.toLocaleString()} need a second look`}
        </p>
      </div>

      {summary && (
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <BigStat label="animals" value={summary.staged.animals} />
          <BigStat label="people" value={summary.staged.contacts} />
          <BigStat label="medical records" value={summary.staged.medical} />
          <BigStat label="adoptions" value={summary.staged.adoptions} />
          <BigStat label="bonded groups" value={summary.staged.bonded_groups} />
          <BigStat label="photos" value={summary.staged.photos} />
        </div>
      )}

      {summary && summary.sample_animals.length > 0 && (
        <p className="mt-6 text-center text-charcoal-soft">
          Say hello to{" "}
          {summary.sample_animals
            .slice(0, 4)
            .map((a) => a.name)
            .join(", ")}
          {summary.staged.animals > 4 && ` and ${summary.staged.animals - 4} more friends`}.
        </p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        {info.job.rows_flagged > 0 && (
          <a
            href={`/api/import/${jobId}/report`}
            className="rounded-full border-2 border-terracotta px-6 py-3 font-display font-semibold text-terracotta-deep hover:bg-terracotta hover:text-white transition-colors"
          >
            Download the needs-attention report
          </a>
        )}
      </div>

      {claimed ? (
        <div className="mt-12 text-center rounded-blob bg-meadow text-white p-10">
          <h2 className="text-2xl font-display font-semibold">This import has a home now.</h2>
          <Link
            to="/app"
            className="inline-block mt-4 rounded-full bg-sunflower px-6 py-3 font-display font-semibold text-charcoal shadow-soft"
          >
            Go to your dashboard
          </Link>
        </div>
      ) : (
        <ClaimForm jobId={jobId} />
      )}
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-blob bg-white shadow-soft p-5 text-center">
      <div className="text-3xl font-display font-bold text-meadow-deep">
        {value.toLocaleString()}
      </div>
      <div className="text-sm font-semibold text-charcoal-soft">{label}</div>
    </div>
  );
}

function ClaimForm({ jobId }: { jobId: string }) {
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/import/${jobId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_name: orgName, email, name, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not create your account.");
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={claim}
      className="mt-12 mx-auto max-w-lg rounded-blob bg-white shadow-lift p-8 space-y-4"
    >
      <h2 className="text-2xl font-display font-semibold text-center">
        Keep this data — create your free home
      </h2>
      <p className="text-center text-sm text-charcoal-soft">
        One click and everything above moves into your own Via Tutela account.
        Free tier, no card, no strings.
      </p>
      <label className="block">
        <span className="font-semibold text-sm">Your rescue or shelter's name</span>
        <input
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Sunny Meadow Rescue"
          className="mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none"
        />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Your email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@sunnymeadow.org"
          className="mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none"
        />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Your name (optional)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Frances"
          className="mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none"
        />
      </label>
      <label className="block">
        <span className="font-semibold text-sm">Pick a password (8+ characters)</span>
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none"
        />
      </label>
      {error && (
        <p className="font-semibold text-terracotta-deep" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-meadow px-6 py-3.5 font-display font-semibold text-lg text-white shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
      >
        {busy ? "Making up the beds…" : "Create my free account & keep this data"}
      </button>
    </form>
  );
}
