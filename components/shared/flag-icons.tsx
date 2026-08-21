/**
 * Inline SVG flags for the language switcher.
 *
 * Deliberately NOT emoji (🇻🇳/🇬🇧): Windows ships no flag glyphs, so emoji
 * flags degrade to bare "VN"/"GB" letter boxes there — which would collide
 * with the "VI"/"EN" codes sitting right next to them. Inline SVG renders
 * identically on every platform and inherits size from the caller.
 *
 * Both use a 3:2 viewBox so they share one set of width/height classes.
 */

type FlagProps = { className?: string };

export function FlagVi({ className }: FlagProps) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true" focusable="false">
      <rect width="30" height="20" fill="#DA251D" />
      <polygon
        fill="#FFFF00"
        points="15,5 16.12,8.46 19.76,8.46 16.82,10.59 17.94,14.05 15,11.91 12.06,14.05 13.18,10.59 10.24,8.46 13.88,8.46"
      />
    </svg>
  );
}

export function FlagEn({ className }: FlagProps) {
  // Union Jack, simplified: the real flag counterchanges the red saltire so
  // each diagonal half is offset. That detail is sub-pixel at the ~18px this
  // renders at, and reproducing it needs per-quadrant <clipPath> ids — which
  // would collide between the two instances mounted per page.
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true" focusable="false">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2.5" />
      <path d="M30,0 L30,30 M0,15 L60,15" stroke="#FFFFFF" strokeWidth="10" />
      <path d="M30,0 L30,30 M0,15 L60,15" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
