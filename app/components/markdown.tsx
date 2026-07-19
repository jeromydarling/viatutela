/**
 * Tiny, safe-by-construction markdown renderer.
 * Supports: ## / ### headings, paragraphs, - lists, **bold**, *italic*,
 * [links](https://…). Everything is emitted as React elements — no
 * dangerouslySetInnerHTML, so shelter-authored content can never inject
 * script into a visitor's browser.
 */

import { Fragment } from "react";

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // tokenize links first, then bold/italic inside remaining text
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  const pushStyled = (chunk: string) => {
    const boldRe = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let l = 0;
    let bm: RegExpExecArray | null;
    while ((bm = boldRe.exec(chunk))) {
      if (bm.index > l) out.push(<Fragment key={`${keyBase}-t${k++}`}>{chunk.slice(l, bm.index)}</Fragment>);
      if (bm[1] !== undefined) out.push(<strong key={`${keyBase}-b${k++}`}>{bm[1]}</strong>);
      else out.push(<em key={`${keyBase}-i${k++}`}>{bm[2]}</em>);
      l = bm.index + bm[0].length;
    }
    if (l < chunk.length) out.push(<Fragment key={`${keyBase}-t${k++}`}>{chunk.slice(l)}</Fragment>);
  };
  while ((m = linkRe.exec(text))) {
    if (m.index > last) pushStyled(text.slice(last, m.index));
    const href = m[2];
    const external = href.startsWith("http");
    out.push(
      <a
        key={`${keyBase}-a${k++}`}
        href={href}
        className="font-semibold underline decoration-2 underline-offset-2"
        {...(external ? { rel: "noopener noreferrer" } : {})}
      >
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) pushStyled(text.slice(last));
  return out;
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((block, bi) => {
        if (block.startsWith("### ")) {
          return <h3 key={bi} className="text-xl font-display font-semibold">{renderInline(block.slice(4), `h3-${bi}`)}</h3>;
        }
        if (block.startsWith("## ")) {
          return <h2 key={bi} className="text-2xl font-display font-semibold">{renderInline(block.slice(3), `h2-${bi}`)}</h2>;
        }
        const lines = block.split("\n");
        if (lines.every((l) => /^[-*] /.test(l.trim()))) {
          return (
            <ul key={bi} className="list-disc pl-6 space-y-1">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.trim().slice(2), `li-${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="leading-relaxed">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l, `p-${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
