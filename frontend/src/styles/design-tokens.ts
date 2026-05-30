/**
 * SIPHON-X Kinetic Ledger Design Tokens
 * All values reference CSS custom properties from globals.css
 *
 * Color scheme: Indigo/Purple on dark (#0b1326) background
 * Font: Geist (headlines) / Inter (body) / JetBrains Mono (data)
 * Design philosophy: tonal layering + borders for depth
 */

/* ── Color Palette ── */
export const colors = {
  bg: "var(--sx-bg)",
  bgLower: "var(--sx-bg-lower)",
  surface: "var(--sx-surface)",
  surfaceHigh: "var(--sx-surface-high)",
  surfaceHighest: "var(--sx-surface-highest)",

  primary: "var(--sx-primary)",
  primaryContainer: "var(--sx-primary-container)",
  primarySoft: "var(--sx-primary-soft)",
  primaryGlow: "var(--sx-primary-glow)",

  secondary: "var(--sx-secondary)",
  secondaryContainer: "var(--sx-secondary-container)",

  tertiary: "var(--sx-tertiary)",
  tertiaryContainer: "var(--sx-tertiary-container)",

  success: "var(--sx-success)",
  warning: "var(--sx-warning)",
  danger: "var(--sx-danger)",
  info: "var(--sx-info)",

  text: "var(--sx-text)",
  textSecondary: "var(--sx-text-secondary)",
  textMuted: "var(--sx-text-muted)",
  textDim: "var(--sx-text-dim)",

  border: "var(--sx-border)",
  borderSubtle: "var(--sx-border-subtle)",
  borderStrong: "var(--sx-border-strong)",
} as const;

/* ── Chart Colors ── */
export const chartColors = {
  primary: "#6366f1",
  secondary: "#a855f7",
  tertiary: "#d97721",
} as const;

export type ChartColor = keyof typeof chartColors;

/* ── Spacing Scale (4px base) ── */
export const spacing = {
  1: "var(--sx-space-1)",
  2: "var(--sx-space-2)",
  3: "var(--sx-space-3)",
  4: "var(--sx-space-4)",
  5: "var(--sx-space-5)",
  6: "var(--sx-space-6)",
  8: "var(--sx-space-8)",
  10: "var(--sx-space-10)",
  12: "var(--sx-space-12)",
  16: "var(--sx-space-16)",
} as const;

/* ── Border Radius ── */
export const radii = {
  sm: "var(--sx-radius-sm)",
  md: "var(--sx-radius-md)",
  lg: "var(--sx-radius-lg)",
  full: "var(--sx-radius-full)",
} as const;

/* ── Typography ── */
export const typography = {
  headline: {
    lg: "var(--sx-hl-lg)",
    md: "var(--sx-hl-md)",
    sm: "var(--sx-hl-sm)",
  },
  body: {
    lg: "var(--sx-body-lg)",
    md: "var(--sx-body-md)",
    sm: "var(--sx-body-sm)",
  },
  label: "var(--sx-label-caps)",
  data: "var(--sx-data-tabular)",
} as const;

/* ── Glow Effects ── */
export const glow = {
  primary: "var(--sx-glow-primary)",
  success: "var(--sx-glow-success)",
  danger: "var(--sx-glow-danger)",
} as const;

/* ── Font Families ── */
export const fonts = {
  headline: "var(--font-headline)",
  body: "var(--font-body)",
  mono: "var(--font-mono)",
} as const;

export type ColorKey = keyof typeof colors;
export type SpacingKey = keyof typeof spacing;
export type RadiiKey = keyof typeof radii;
