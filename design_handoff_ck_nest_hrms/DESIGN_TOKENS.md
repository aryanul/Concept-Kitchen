# Design Tokens

Drop-in CSS variables. Match values exactly — every screen in the prototype uses these.

```css
:root {
  /* ----- Brand & accent ----- */
  --ck-accent: #E91E63;        /* primary action; sidebar active rail; key buttons */
  --ck-accent-hover: #D81557;
  --ck-accent-soft: #FCE4EC;   /* tinted backgrounds, badges */

  /* ----- Neutrals ----- */
  --ck-ink: #272727;           /* primary text */
  --ck-ink-soft: #4D4D4D;      /* secondary text */
  --ck-muted: #6B7280;         /* tertiary text, labels */
  --ck-faint: #9CA3AF;         /* placeholders, captions */
  --ck-line: #ECECEC;          /* default borders */
  --ck-line-soft: #F4F4F5;     /* subtle dividers, hover bg */
  --ck-bg: #F9FAFB;            /* app background */
  --ck-surface: #FFFFFF;       /* cards, drawers, modals */
  --ck-surface-alt: #FAFAFA;   /* zebra rows, info chips */

  /* ----- Status (use OKLCH so they stay perceptually balanced) ----- */
  --ck-success: oklch(0.55 0.16 145);
  --ck-success-bg: oklch(0.95 0.05 145);
  --ck-success-fg: oklch(0.42 0.12 145);

  --ck-warning: oklch(0.70 0.15 75);
  --ck-warning-bg: oklch(0.96 0.06 75);
  --ck-warning-fg: oklch(0.45 0.12 75);

  --ck-danger:  oklch(0.58 0.20 25);
  --ck-danger-bg:  oklch(0.95 0.05 25);
  --ck-danger-fg:  oklch(0.45 0.16 25);

  --ck-info:    oklch(0.55 0.14 250);
  --ck-info-bg:    oklch(0.95 0.04 250);
  --ck-info-fg:    oklch(0.42 0.12 250);

  /* ----- Typography ----- */
  --ck-font-sans: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  --ck-font-mono: 'Roboto Mono', ui-monospace, monospace;

  /* Type scale (px) */
  --ck-fs-display: 28px;   /* dashboard stat values */
  --ck-fs-h1: 24px;        /* page titles */
  --ck-fs-h2: 18px;        /* card titles */
  --ck-fs-h3: 15px;        /* row titles, dense headings */
  --ck-fs-body: 14px;      /* default body */
  --ck-fs-sm: 13px;        /* secondary body, table cells */
  --ck-fs-xs: 12px;        /* hints, helper text */
  --ck-fs-micro: 11px;     /* uppercase labels, badge text */

  --ck-lh-tight: 1.2;
  --ck-lh-default: 1.45;
  --ck-lh-loose: 1.6;

  /* ----- Spacing scale (px) ----- */
  --ck-s-1: 4px;
  --ck-s-2: 8px;
  --ck-s-3: 12px;
  --ck-s-4: 16px;
  --ck-s-5: 20px;
  --ck-s-6: 24px;
  --ck-s-7: 32px;
  --ck-s-8: 40px;
  --ck-s-9: 56px;
  --ck-s-10: 72px;

  /* ----- Radii ----- */
  --ck-r-sm: 6px;          /* inputs, small chips */
  --ck-r-md: 8px;          /* default */
  --ck-r-lg: 10px;         /* section headers */
  --ck-r-xl: 14px;         /* cards, modals */
  --ck-r-pill: 999px;      /* status pills, weather chip */

  /* ----- Shadows ----- */
  --ck-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
  --ck-shadow-md: 0 4px 12px rgba(15, 23, 42, 0.06);
  --ck-shadow-lg: 0 12px 32px rgba(15, 23, 42, 0.10);

  /* ----- Layout ----- */
  --ck-sidebar-w: 244px;
  --ck-topbar-h: 64px;
  --ck-content-max: 1440px;
  --ck-drawer-w: 720px;

  /* ----- Motion ----- */
  --ck-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ck-dur-fast: 160ms;
  --ck-dur-default: 220ms;
  --ck-dur-slow: 360ms;

  /* ----- Z-index ----- */
  --ck-z-sidebar: 10;
  --ck-z-topbar: 20;
  --ck-z-drawer: 40;
  --ck-z-modal: 50;
  --ck-z-toast: 60;
}
```

## Component-level conventions

### Buttons
- **Primary**: bg `var(--ck-accent)`, text `#fff`, hover `var(--ck-accent-hover)`, radius `--ck-r-md`, height 40 (md) / 32 (sm), padding `0 16px`, fs 14, fw 500.
- **Secondary**: bg `#fff`, border `1px solid var(--ck-line)`, text `var(--ck-ink)`, hover bg `var(--ck-line-soft)`.
- **Ghost**: no border, no bg; hover bg `var(--ck-line-soft)`.
- **Danger**: bg `var(--ck-danger)`, text `#fff`.
- Icon-only buttons: 32×32, radius 8, ghost variant by default.

### Inputs
- Height 40 (md) / 34 (sm). Border `1px solid var(--ck-line)`, radius `--ck-r-md`, padding `0 12px`. Focus: border `var(--ck-accent)`, outline `2px solid var(--ck-accent-soft)`, outline-offset 0.

### Cards
- Bg `#fff`, border `1px solid var(--ck-line)`, radius `--ck-r-xl`, padding 24 (default) or 20 (compact). No drop shadow at rest; `--ck-shadow-md` only on hover for clickable cards.

### Tables
- Header row: bg `var(--ck-bg)`, text `var(--ck-muted)`, fs 12, fw 600, uppercase, letter-spacing `0.04em`, padding `12px 16px`.
- Body row: padding `14px 16px`, border-bottom `1px solid var(--ck-line)`. Hover bg `var(--ck-surface-alt)`.

### Status pills
- Inline-flex, padding `4px 10px`, radius `--ck-r-pill`, fs 12, fw 500, gap 6, leading dot 6×6.
- Map status → token (Active=success, On Leave=info, Probation=warning, Exited=danger, etc.).

### Avatars
- Circle, default 36px. Bg `oklch(0.92 0.04 H)` where H is a hue derived from the name hash. Initials fs 13, fw 600, colour `oklch(0.30 0.05 H)`.

### Density modes (Tweak panel)
Multiply all vertical paddings and gap values by:
- compact: `0.92`
- comfortable: `1.0` (default)
- spacious: `1.06`

## Iconography

Use Lucide React (`lucide-react`). The prototype's `Icon` component in `design/ui.jsx` maps friendly names to Lucide-equivalent SVGs. Icon size defaults: 18 inline, 20 in buttons, 16 in pills, 24 in stat tiles.

## Accessibility

- WCAG AA contrast for all text. The accent `#E91E63` on white passes for ≥14px text — for smaller text, switch to `#C2185B`.
- Visible focus ring on every interactive element (use `:focus-visible`).
- All icon-only buttons need `aria-label`.
- Tables: `<th scope="col">`. Sort buttons announce direction.
- Modals: `role="dialog"`, `aria-modal="true"`, focus trap, Esc to close.
