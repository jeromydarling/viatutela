/**
 * Every way to share an adoptable friend. All links are plain share
 * intents — nothing posts automatically, no tracking scripts.
 */

import { useState } from "react";

export interface ShareTarget {
  url: string; // absolute page url
  title: string; // e.g. "Meet Biscuit"
  blurb: string; // pre-written share text
  imageUrl?: string | null; // absolute, for Pinterest
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

export function shareLinks(t: ShareTarget): { label: string; href: string; emoji: string }[] {
  const text = `${t.blurb} ${t.url}`;
  const links = [
    { label: "Facebook", emoji: "📘", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(t.url)}` },
    { label: "X", emoji: "✖️", href: `https://twitter.com/intent/tweet?text=${enc(t.blurb)}&url=${enc(t.url)}` },
    { label: "WhatsApp", emoji: "💬", href: `https://wa.me/?text=${enc(text)}` },
    { label: "Nextdoor", emoji: "🏘️", href: `https://nextdoor.com/sharekit/?body=${enc(text)}` },
    { label: "Email", emoji: "✉️", href: `mailto:?subject=${enc(t.title)}&body=${enc(`${t.blurb}\n\n${t.url}`)}` },
    { label: "Text", emoji: "📱", href: `sms:?&body=${enc(text)}` },
  ];
  if (t.imageUrl) {
    links.splice(3, 0, {
      label: "Pinterest",
      emoji: "📌",
      href: `https://pinterest.com/pin/create/button/?url=${enc(t.url)}&media=${enc(t.imageUrl)}&description=${enc(t.blurb)}`,
    });
  }
  return links;
}

const btnCls =
  "inline-flex items-center gap-1.5 rounded-full bg-white shadow-soft px-3.5 py-2 text-sm font-semibold hover:shadow-lift transition-shadow";

export function ShareBar({ target, qrSvg, embedSnippet, shareKitHref, flyerHref }: {
  target: ShareTarget;
  qrSvg?: string;
  embedSnippet?: string;
  shareKitHref?: string;
  flyerHref?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: target.title, text: target.blurb, url: target.url });
    } catch {
      // user cancelled or unsupported — the buttons below cover it
    }
  };

  return (
    <div className="mt-6 rounded-blob bg-sunflower-soft/60 p-5">
      <h3 className="font-display font-semibold">
        Sharing is a superpower 💛 <span className="font-normal text-sm text-charcoal-soft">— most adoptions start with a friend's repost</span>
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={nativeShare} className={`${btnCls} bg-meadow text-white`}>
          ↗ Share
        </button>
        {shareLinks(target).map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer noopener" className={btnCls}>
            <span aria-hidden>{l.emoji}</span> {l.label}
          </a>
        ))}
        <button type="button" onClick={() => copy("link", target.url)} className={btnCls}>
          🔗 {copied === "link" ? "Copied!" : "Copy link"}
        </button>
        <button type="button" onClick={() => copy("blurb", `${target.blurb}\n\n${target.url}`)} className={btnCls}>
          📝 {copied === "blurb" ? "Copied!" : "Copy blurb"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {flyerHref && (
          <a href={flyerHref} target="_blank" rel="noreferrer" className={btnCls}>
            🖨️ Print flyer (PDF)
          </a>
        )}
        {shareKitHref && (
          <a href={shareKitHref} className={btnCls}>
            📦 Download share kit
          </a>
        )}
        {qrSvg && (
          <details className="inline-block">
            <summary className={`${btnCls} cursor-pointer list-none`}>▦ QR code</summary>
            <div
              className="mt-2 w-40 rounded-2xl bg-white p-3 shadow-soft [&_svg]:w-full [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </details>
        )}
        {embedSnippet && (
          <details className="inline-block max-w-full">
            <summary className={`${btnCls} cursor-pointer list-none`}>{"</>"} Embed on a website</summary>
            <div className="mt-2">
              <textarea
                readOnly
                rows={3}
                defaultValue={embedSnippet}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full min-w-72 rounded-xl border-2 border-cream bg-white p-2 text-xs font-mono"
              />
              <button type="button" onClick={() => copy("embed", embedSnippet)} className={`${btnCls} mt-1`}>
                {copied === "embed" ? "Copied!" : "Copy embed code"}
              </button>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
