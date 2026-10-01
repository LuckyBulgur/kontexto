/**
 * The Spooktober cast, drawn once as inline SVG.
 *
 * No emoji (M10) and no raster files: every figure is a handful of paths that
 * paints from the `--spook-*` tokens in `app/event-halloween.css`, so it
 * follows light and dark mode without a second set. Every figure is
 * decorative and hidden from assistive technology; what a figure means is
 * always said in text somewhere else (a toast, a label).
 *
 * Not a client module: the wordmark renders the pumpkin on the server.
 */

type GlyphProps = { className?: string };

export function PumpkinGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path d="M29.5 16c-.3-4.6 1.4-8.6 5.2-11.3l3.4 3.2c-2.9 1.9-4.3 4.7-4.1 8.3z" fill="var(--spook-stem)" />
      <ellipse cx="20.5" cy="38" rx="15.5" ry="20" fill="var(--spook-pumpkin-deep)" />
      <ellipse cx="43.5" cy="38" rx="15.5" ry="20" fill="var(--spook-pumpkin-deep)" />
      <ellipse cx="32" cy="38" rx="17" ry="22" fill="var(--spook-pumpkin)" />
      <path
        className="spook-face"
        d="M18.5 34.5l6-8 5.5 8zM34 34.5l5.5-8 6 8zM29.8 40.5l2.2-3.2 2.2 3.2zM16.5 44c7.5 11.5 23.5 11.5 31 0l-4.2 1.4-2 3.3-3.6-2.1-3.7 3.9-3.7-3.9-3.6 2.1-2-3.3z"
        fill="var(--spook-glow)"
      />
    </svg>
  );
}

/** A bat whose wings are a group of their own, so they can beat. */
export function BatGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 32" className={className} aria-hidden="true" focusable="false">
      <g className="spook-wings" fill="var(--spook-night)">
        <path d="M30 14C24 6 14 4 2 8c5 2 7 6 7 10 3-3 7-3 9 0 2-3 6-3 8 1 1-2 3-4 4-5z" />
        <path d="M34 14c6-8 16-10 28-6-5 2-7 6-7 10-3-3-7-3-9 0-2-3-6-3-8 1-1-2-3-4-4-5z" />
      </g>
      <path
        d="M32 10c-1.4 0-2.5.6-3 1.6l-.8-2.6-.6 3.6c-.5 1-.6 2.2-.6 3.4 0 4 2.2 7 5 7s5-3 5-7c0-1.2-.1-2.4-.6-3.4l-.6-3.6-.8 2.6c-.5-1-1.6-1.6-3-1.6z"
        fill="var(--spook-night)"
      />
      <path d="M30.3 14.6h1.2M32.5 14.6h1.2" stroke="var(--spook-glow)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function GhostGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true" focusable="false">
      <path
        d="M32 3C17 3 8 14 8 29v36l7-6 6 6 6-6 5 6 5-6 6 6 6-6 7 6V29C56 14 47 3 32 3z"
        fill="var(--spook-ghost)"
        stroke="var(--spook-ghost-edge)"
        strokeWidth="1.5"
      />
      <ellipse cx="24" cy="28" rx="3.6" ry="5" fill="var(--spook-night)" />
      <ellipse cx="40" cy="28" rx="3.6" ry="5" fill="var(--spook-night)" />
      <ellipse cx="32" cy="42" rx="4.5" ry="5.5" fill="var(--spook-night)" />
    </svg>
  );
}

export function SpiderGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 48 40" className={className} aria-hidden="true" focusable="false">
      <g stroke="var(--spook-night)" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M18 18L8 10 2 14M18 21L6 19 1 24M19 24L8 28 4 35M20 26l-6 7-1 6" />
        <path d="M30 18l10-8 6 4M30 21l12-2 5 5M29 24l11 4 4 7M28 26l6 7 1 6" />
      </g>
      <ellipse cx="24" cy="24" rx="7" ry="8" fill="var(--spook-night)" />
      <circle cx="24" cy="14" r="5" fill="var(--spook-night)" />
      <circle cx="22.2" cy="13.4" r="1.2" fill="var(--spook-glow)" />
      <circle cx="25.8" cy="13.4" r="1.2" fill="var(--spook-glow)" />
    </svg>
  );
}

export function WitchGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 120 64" className={className} aria-hidden="true" focusable="false">
      <g fill="var(--spook-night)">
        {/* broom */}
        <path d="M8 44l76-6 .4 3-76 6z" />
        <path d="M84 36c10-2 22 0 32 6-10 1-18 5-26 9-2-5-4-10-6-15z" />
        {/* body and cape */}
        <path d="M40 42c2-10 8-18 16-20l6 4c-2 5-2 10 0 15l-10 2c-4 0-8 0-12-1z" />
        <path d="M44 40c-8-4-16-4-24 0 6-6 14-10 24-10z" />
        {/* head and hat */}
        <circle cx="60" cy="20" r="6" />
        <path d="M52 16l16-2c-2-4-6-12-2-15-6 1-10 6-11 11z" />
        <path d="M48 16.5c6-2 16-3 24-2l-.5 2.5c-8-1-16 0-23 1.5z" />
        {/* legs */}
        <path d="M50 42l-6 10 3 1 6-10zM56 42l-2 11 3 .5 2-11z" />
      </g>
    </svg>
  );
}

/** A cat walking left, its body a group of its own so it can step. */
export function CatGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 96 56" className={className} aria-hidden="true" focusable="false">
      <g fill="var(--spook-night)">
        <g className="spook-cat-step">
          <path d="M20 18l3-10 5 7c3-1 6-1 9 0l5-7 2 11c3 3 4 7 3 11l18-2c10 0 18 4 20 12 1-7 3-14 8-18-2 9-3 16-6 22H14c0-6 1-14 6-17-1-3-1-6 0-9z" />
        </g>
        <path d="M24 44h4v10h-4zM34 44h4v10h-4zM62 44h4v10h-4zM72 44h4v10h-4z" />
      </g>
      <circle cx="26" cy="22" r="1.6" fill="var(--spook-glow)" />
      <circle cx="35" cy="22" r="1.6" fill="var(--spook-glow)" />
    </svg>
  );
}

export function HandGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 70 110" className={className} aria-hidden="true" focusable="false">
      <g fill="var(--spook-ghost)" stroke="var(--spook-ghost-edge)" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M27 110V70c-6-2-11-8-12-16l-4-16c-1-3 3-5 5-2l6 12V20c0-3 5-3 5 0v26h2V10c0-3 5-3 5 0v36h2V14c0-3 5-3 5 0v32h2V22c0-3 5-3 5 0v34c0 8-5 13-11 14v40z" />
      </g>
      <path
        d="M27 58v-6M33 58V46M39 58V46M45 58V48"
        stroke="var(--spook-ghost-edge)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SmokeGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 70 70" className={className} aria-hidden="true" focusable="false">
      <g fill="var(--spook-ghost)" stroke="var(--spook-ghost-edge)" strokeWidth="1">
        <circle cx="24" cy="40" r="14" />
        <circle cx="44" cy="36" r="16" />
        <circle cx="34" cy="22" r="12" />
      </g>
    </svg>
  );
}

export function OwlGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 80 60" className={className} aria-hidden="true" focusable="false">
      <g fill="var(--spook-night)">
        <path d="M40 14c-8 0-13 6-13 14 0 10 6 18 13 18s13-8 13-18c0-8-5-14-13-14z" />
        <path d="M28 18l-2-8 7 5zM52 18l2-8-7 5z" />
        <path d="M28 30C18 22 8 22 0 28c8 0 12 4 14 10 4-4 9-6 14-4zM52 30c10-8 20-8 28-2-8 0-12 4-14 10-4-4-9-6-14-4z" />
      </g>
      <circle cx="35" cy="26" r="4" fill="var(--spook-glow)" />
      <circle cx="45" cy="26" r="4" fill="var(--spook-glow)" />
      <circle cx="35" cy="26" r="1.6" fill="var(--spook-night)" />
      <circle cx="45" cy="26" r="1.6" fill="var(--spook-night)" />
      <path d="M38.5 31l1.5 3 1.5-3z" fill="var(--spook-pumpkin)" />
    </svg>
  );
}

/** A wolf sitting with its head raised, howling. */
export function WolfGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden="true" focusable="false">
      <g fill="var(--spook-night)">
        <path d="M30 90c2-14 6-26 14-34l-6-10c4 0 8 1 11 3l4-18 6 14c4-6 8-14 10-24 2 8 1 16-1 22l10 6c-4 2-9 2-13 1 4 8 8 18 9 30 6 2 12 6 16 10z" />
        <path d="M40 90H26c4-8 10-12 18-14z" />
      </g>
    </svg>
  );
}

/** Two eyes in the dark. The lids are a group of their own, so they can blink. */
export function EyesGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 24" className={className} aria-hidden="true" focusable="false">
      <g className="spook-lids">
        <ellipse cx="18" cy="12" rx="8" ry="5" fill="var(--spook-glow)" />
        <ellipse cx="46" cy="12" rx="8" ry="5" fill="var(--spook-glow)" />
        <circle cx="19" cy="12" r="2.2" fill="var(--spook-night)" />
        <circle cx="47" cy="12" r="2.2" fill="var(--spook-night)" />
      </g>
    </svg>
  );
}

export function FogGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 420 140" preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
      <path fill="var(--spook-fog-word)" d="M0 140V50c60-30 120 20 200-6s150-14 220 10v86z" />
      <path fill="var(--spook-fog-word)" d="M0 140V90c70-20 140 10 210-4s140-6 210 8v46z" />
    </svg>
  );
}
