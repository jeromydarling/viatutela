/**
 * Hand-drawn-style line-art animal doodles (inline SVG).
 * The recurring motif: a little bird + companion animals.
 */

interface DoodleProps {
  className?: string;
  title?: string;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function BirdDoodle({ className, title }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <g {...stroke}>
        <path d="M30 62 Q28 44 44 40 Q62 36 66 50 Q70 62 56 68 Q40 74 30 62 Z" />
        <path d="M44 40 Q46 30 56 28 Q54 36 58 40" />
        <circle cx="52" cy="48" r="1.6" fill="currentColor" />
        <path d="M66 50 L78 46 L68 56" />
        <path d="M46 68 v8 M54 68 v8" />
        <path d="M42 76 h8 M50 76 h8" />
      </g>
    </svg>
  );
}

export function DogDoodle({ className, title }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <g {...stroke}>
        <path d="M22 70 Q20 50 36 48 L62 46 Q76 45 78 56 Q80 68 66 70 Z" />
        <path d="M62 46 Q60 32 72 28 Q84 25 86 36 Q88 46 78 50" />
        <path d="M72 28 q-2 -8 4 -10 q4 6 2 10" />
        <circle cx="76" cy="38" r="1.6" fill="currentColor" />
        <path d="M28 70 v12 M40 70 v12 M58 70 v12 M70 70 v12" />
        <path d="M22 64 q-10 -2 -8 -12" />
      </g>
    </svg>
  );
}

export function CatDoodle({ className, title }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <g {...stroke}>
        <path d="M30 74 Q26 56 42 54 L60 52 Q72 52 74 62 Q75 72 64 74 Z" />
        <path d="M60 52 Q58 38 68 34 Q80 30 82 40 Q84 50 74 54" />
        <path d="M66 35 l-2 -9 l7 6 M76 33 l3 -8 l3 8" />
        <circle cx="72" cy="43" r="1.5" fill="currentColor" />
        <path d="M34 74 v10 M44 74 v10 M58 74 v10 M68 74 v10" />
        <path d="M30 68 q-12 0 -10 -14 q1 -6 6 -8" />
      </g>
    </svg>
  );
}

export function WolfDoodle({ className, title }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <g {...stroke}>
        <path d="M20 72 Q18 52 38 50 L60 48 Q74 47 76 58 Q78 70 64 72 Z" />
        <path d="M60 48 Q60 30 74 26 L84 34 Q88 44 76 52" />
        <path d="M74 26 l-1 -10 l8 8 M82 30 l6 -6 l0 9" />
        <circle cx="76" cy="38" r="1.6" fill="currentColor" />
        <path d="M26 72 v12 M38 72 v12 M56 72 v12 M68 72 v12" />
        <path d="M20 66 q-8 -6 -4 -16" />
        <path d="M84 34 l6 2" />
      </g>
    </svg>
  );
}

export function PawDoodle({ className, title }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <g {...stroke}>
        <ellipse cx="50" cy="62" rx="16" ry="13" />
        <ellipse cx="30" cy="42" rx="6" ry="8" />
        <ellipse cx="44" cy="34" rx="6" ry="8" />
        <ellipse cx="58" cy="34" rx="6" ry="8" />
        <ellipse cx="71" cy="42" rx="6" ry="8" />
      </g>
    </svg>
  );
}

export function HeartPawDoodle({ className, title }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <g {...stroke}>
        <path d="M50 82 Q22 62 20 42 Q19 26 34 24 Q45 23 50 34 Q55 23 66 24 Q81 26 80 42 Q78 62 50 82 Z" />
        <ellipse cx="50" cy="52" rx="7" ry="6" />
        <circle cx="40" cy="41" r="3" />
        <circle cx="50" cy="37" r="3" />
        <circle cx="60" cy="41" r="3" />
      </g>
    </svg>
  );
}
