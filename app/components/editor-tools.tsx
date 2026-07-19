/**
 * Editor niceties for the website builder: a visual media picker fed by
 * the media library AND animal photos, and a tiny markdown toolbar.
 * Both drive plain uncontrolled inputs by id — no state library, no
 * WYSIWYG engine to fight, output stays honest markdown/URLs.
 */

import { useState } from "react";

export interface PickableImage {
  url: string;
  label: string;
  group: "library" | "animals";
}

export function MediaPicker({
  targetId,
  images,
  insertMarkdown = false,
}: {
  targetId: string;
  images: PickableImage[];
  /** true → insert `![label](url)` at the textarea cursor instead of replacing the value */
  insertMarkdown?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (images.length === 0) return null;

  const pick = (img: PickableImage) => {
    const el = document.getElementById(targetId) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) {
      if (insertMarkdown && el instanceof HTMLTextAreaElement) {
        const at = el.selectionStart ?? el.value.length;
        const snippet = `\n\n![${img.label}](${img.url})\n\n`;
        el.value = el.value.slice(0, at) + snippet + el.value.slice(at);
      } else {
        el.value = img.url;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-sky/15 text-sky-deep px-3 py-1 text-xs font-bold hover:bg-sky/25 transition-colors"
      >
        🖼 Pick a photo
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-3xl shadow-lift max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Pick a photo"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Pick a photo</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-cream font-bold">✕</button>
            </div>
            {(["library", "animals"] as const).map((group) => {
              const grouped = images.filter((i) => i.group === group);
              if (grouped.length === 0) return null;
              return (
                <div key={group} className="mt-4">
                  <p className="text-xs font-bold text-charcoal-soft uppercase tracking-wide">
                    {group === "library" ? "Media library" : "Animal photos"}
                  </p>
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {grouped.map((img) => (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() => pick(img)}
                        className="group relative rounded-xl overflow-hidden border-2 border-cream hover:border-meadow focus:border-meadow"
                        title={img.label}
                      >
                        <img src={img.url} alt={img.label} loading="lazy" className="w-full aspect-square object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-charcoal/60 text-white text-[10px] font-semibold px-1.5 py-0.5 truncate opacity-0 group-hover:opacity-100">
                          {img.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/** Insert-at-cursor markdown toolbar for a textarea (by id). */
export function MdToolbar({ targetId, images }: { targetId: string; images: PickableImage[] }) {
  const wrap = (before: string, after = "", placeholder = "") => {
    const el = document.getElementById(targetId) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = el.value.slice(start, end) || placeholder;
    el.value = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
    el.focus();
    el.setSelectionRange(start + before.length, start + before.length + selected.length);
  };
  const btn = "rounded-md bg-cream px-2 py-0.5 text-xs font-bold hover:bg-sunflower-soft transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={btn} onClick={() => wrap("**", "**", "bold words")}><strong>B</strong></button>
      <button type="button" className={`${btn} italic`} onClick={() => wrap("*", "*", "gentle emphasis")}>i</button>
      <button type="button" className={btn} onClick={() => wrap("\n\n## ", "", "A heading")}>H2</button>
      <button type="button" className={btn} onClick={() => wrap("\n- ", "", "first thing")}>• list</button>
      <button type="button" className={btn} onClick={() => wrap("[", "](https://)", "link text")}>🔗</button>
      <MediaPicker targetId={targetId} images={images} insertMarkdown />
    </div>
  );
}
