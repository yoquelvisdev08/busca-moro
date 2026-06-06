/**
 * Orion Design Tokens
 * All values reference CSS custom properties from theme.css
 *
 * Color scheme: Indigo/Purple on dark (#15121b) background
 * Font: Inter
 * Design philosophy: tonal layering + borders for depth, no shadows
 */

/* ── Color Palette ── */
export const colors = {
  /* Background hierarchy */
  bg: "var(--sx-bg)",
  bgLower: "var(--sx-bg-lower)",
  surface: "var(--sx-surface)",
  surfaceHigh: "var(--sx-surface-high)",
  surfaceHighest: "var(--sx-surface-highest)",

  /* Primary — indigo/purple accent */
  primary: "var(--sx-primary)",
  primaryContainer: "var(--sx-primary-container)",
  primarySoft: "var(--sx-primary-soft)",
  primaryGlow: "var(--sx-primary-glow)",

  /* Secondary */
  secondary: "var(--sx-secondary)",
  secondaryContainer: "var(--sx-secondary-container)",

  /* Tertiary */
  tertiary: "var(--sx-tertiary)",
  tertiaryContainer: "var(--sx-tertiary-container)",

  /* Semantic */
  success: "var(--sx-success)",
  warning: "var(--sx-warning)",
  danger: "var(--sx-danger)",
  info: "var(--sx-info)",

  /* Text hierarchy */
  text: "var(--sx-text)",
  textSecondary: "var(--sx-text-secondary)",
  textMuted: "var(--sx-text-muted)",
  textDim: "var(--sx-text-dim)",

  /* Borders */
  border: "var(--sx-border)",
  borderSubtle: "var(--sx-border-subtle)",
  borderStrong: "var(--sx-border-strong)",
} as const;

/* ── Typography Scale ── */
export const typography = {
  display: {
    "2xl": { fontSize: "72px", fontWeight: 700, lineHeight: "1.1", letterSpacing: "-0.02em" },
    lg: { fontSize: "48px", fontWeight: 700, lineHeight: "1.15", letterSpacing: "-0.02em" },
  },
  headline: {
    lg: { fontSize: "32px", fontWeight: 600, lineHeight: "1.2", letterSpacing: "-0.01em" },
    md: { fontSize: "24px", fontWeight: 600, lineHeight: "1.25", letterSpacing: "-0.01em" },
    sm: { fontSize: "20px", fontWeight: 600, lineHeight: "1.3", letterSpacing: "0em" },
  },
  body: {
    lg: { fontSize: "16px", fontWeight: 400, lineHeight: "1.5", letterSpacing: "0em" },
    md: { fontSize: "14px", fontWeight: 400, lineHeight: "1.5", letterSpacing: "0em" },
    sm: { fontSize: "12px", fontWeight: 400, lineHeight: "1.5", letterSpacing: "0.01em" },
  },
  label: {
    lg: { fontSize: "14px", fontWeight: 600, lineHeight: "1.3", letterSpacing: "0.06em" },
    md: { fontSize: "12px", fontWeight: 600, lineHeight: "1.3", letterSpacing: "0.06em" },
    sm: { fontSize: "10px", fontWeight: 600, lineHeight: "1.3", letterSpacing: "0.08em" },
  },
  mono: {
    lg: { fontSize: "16px", fontWeight: 500, lineHeight: "1.5", letterSpacing: "0em", fontFamily: "var(--font-mono)" },
    md: { fontSize: "14px", fontWeight: 500, lineHeight: "1.5", letterSpacing: "0em", fontFamily: "var(--font-mono)" },
    sm: { fontSize: "12px", fontWeight: 500, lineHeight: "1.5", letterSpacing: "0em", fontFamily: "var(--font-mono)" },
  },
} as const;

/* ── Spacing Scale (4px base) ── */
export const spacing = {
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

/* ── Border Radius ── */
export const radii = {
  sm: "var(--radius-sm)",   // 4px
  md: "var(--radius-md)",   // 8px
  lg: "var(--radius-lg)",   // 8px
  full: "9999px",
} as const;

/* ── Shadows ── */
export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
  md: "0 4px 12px rgba(0, 0, 0, 0.4)",
  lg: "0 8px 24px rgba(0, 0, 0, 0.5)",
  glow: "var(--shadow-glow-cyan)",
} as const;

/* ── Component Variants ── */
export const componentTokens = {
  button: {
    borderRadius: radii.sm,
    fontWeight: 600,
    fontFamily: "var(--font-sans)",
    sizes: {
      sm: { padding: "4px 12px", fontSize: "12px", height: "28px" },
      md: { padding: "8px 16px", fontSize: "14px", height: "36px" },
      lg: { padding: "12px 24px", fontSize: "16px", height: "44px" },
    },
  },
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.md,
    padding: "20px",
  },
  input: {
    background: "var(--sx-bg)",
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: radii.sm,
    padding: "8px 12px",
    fontSize: "14px",
    color: colors.text,
  },
  badge: {
    borderRadius: radii.full,
    padding: "2px 10px",
    fontSize: "12px",
    fontWeight: 500,
  },
} as const;

export type ColorKey = keyof typeof colors;
export type SpacingKey = keyof typeof spacing;
export type RadiiKey = keyof typeof radii;
