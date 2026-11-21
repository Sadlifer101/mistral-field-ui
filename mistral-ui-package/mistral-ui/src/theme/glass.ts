/**
 * Shared surface + colour tokens for the Mistral specialist console.
 *
 * GLASS VALUES ARE LOCKED. The dark material below is byte-for-byte the one
 * that already ships in the motion preview (src/preview/motion/main.tsx ->
 * panelStyle): same transparency, blur, tint, border, inset highlight and drop
 * shadow. The console reuses that single material through `glass(theme)` so
 * there is never a second competing glassmorphism system.
 *
 * Light mode is the same material geometry with an inverted tint, which is what
 * keeps the existing day/night toggle working.
 */
import type { CSSProperties } from "react";

export type ThemeMode = "light" | "dark";

/* ------------------------------------------------------------------ glass -- */

const DARK = {
  /** Primary card surface - the locked material. */
  panel: {
    position: "relative",
    borderRadius: 20,
    border: "1px solid rgba(232,226,248,0.10)",
    background:
      "linear-gradient(158deg, rgba(255,255,255,0.060) 0%, rgba(255,255,255,0.014) 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.07), 0 30px 70px -34px rgba(0,0,0,0.9)",
    backdropFilter: "blur(20px) saturate(118%)",
    WebkitBackdropFilter: "blur(20px) saturate(118%)",
  } as CSSProperties,

  /** Same material without the drop shadow - nav capsule, inner rows, buttons. */
  surface: {
    position: "relative",
    borderRadius: 14,
    border: "1px solid rgba(232,226,248,0.10)",
    background:
      "linear-gradient(158deg, rgba(255,255,255,0.060) 0%, rgba(255,255,255,0.014) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
    backdropFilter: "blur(20px) saturate(118%)",
    WebkitBackdropFilter: "blur(20px) saturate(118%)",
  } as CSSProperties,

  /** Selected / active state: the same surface plus a lavender wash. */
  active: {
    position: "relative",
    borderRadius: 14,
    border: "1px solid rgba(206,192,240,0.30)",
    background:
      "linear-gradient(158deg, rgba(198,182,232,0.16) 0%, rgba(150,136,186,0.06) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(20px) saturate(118%)",
    WebkitBackdropFilter: "blur(20px) saturate(118%)",
  } as CSSProperties,

  text: {
    primary: "#F4F1FA",
    secondary: "rgba(232,226,248,0.66)",
    muted: "rgba(226,219,244,0.45)",
    faint: "rgba(226,219,244,0.30)",
  },
  hairline: "rgba(232,226,248,0.09)",
  track: "rgba(255,255,255,0.09)",
};

const LIGHT = {
  panel: {
    position: "relative",
    borderRadius: 20,
    border: "1px solid rgba(17,19,21,0.10)",
    background:
      "linear-gradient(158deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.78) 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.9), 0 30px 70px -34px rgba(17,19,21,0.35)",
    backdropFilter: "blur(20px) saturate(118%)",
    WebkitBackdropFilter: "blur(20px) saturate(118%)",
  } as CSSProperties,

  surface: {
    position: "relative",
    borderRadius: 14,
    border: "1px solid rgba(17,19,21,0.10)",
    background:
      "linear-gradient(158deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.78) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
    backdropFilter: "blur(20px) saturate(118%)",
    WebkitBackdropFilter: "blur(20px) saturate(118%)",
  } as CSSProperties,

  active: {
    position: "relative",
    borderRadius: 14,
    border: "1px solid rgba(13,148,136,0.35)",
    background:
      "linear-gradient(158deg, rgba(13,148,136,0.10) 0%, rgba(13,148,136,0.04) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
    backdropFilter: "blur(20px) saturate(118%)",
    WebkitBackdropFilter: "blur(20px) saturate(118%)",
  } as CSSProperties,

  text: {
    primary: "#111315",
    secondary: "rgba(17,19,21,0.72)",
    muted: "rgba(17,19,21,0.52)",
    faint: "rgba(17,19,21,0.34)",
  },
  hairline: "rgba(17,19,21,0.10)",
  track: "rgba(17,19,21,0.10)",
};

export const glass = (theme: ThemeMode) => (theme === "dark" ? DARK : LIGHT);

/* ----------------------------------------------------------------- colour -- */

/** Lavender accent, used only for selection, focus and the primary action. */
export const ACCENT = {
  ink: "#F3EEFF",
  text: "#D8CBEF",
  border: "rgba(206,192,240,0.48)",
  wash: "rgba(178,162,214,0.22)",
  washStrong: "rgba(178,162,214,0.34)",
  solid: "#B9A8D9",
  /** Primary action fill (Sign-off / Approve Treatment). */
  action: "linear-gradient(180deg, #C9B7E4 0%, #A98FCB 100%)",
  actionHover: "linear-gradient(180deg, #D3C2EC 0%, #B49BD6 100%)",
  /** Queue row selection / soft tab wash. */
  soft: "rgba(186,171,222,0.18)",
  softBorder: "rgba(206,192,240,0.34)",
  /** Model-estimate bar fill. */
  bar: "linear-gradient(90deg, #B49BD6 0%, #CDBAE9 100%)",
  /** Waveform ink. */
  wave: "rgba(203,186,232,0.85)",
  waveIdle: "rgba(203,186,232,0.30)",
} as const;

/** Clinical priority indicators - muted, never neon. */
export const STATUS = {
  high: {
    dot: "#E6384B",
    bg: "rgba(230,57,70,0.18)",
    border: "rgba(230,57,70,0.34)",
    text: "#F2A4AE",
    label: "High",
  },
  medium: {
    dot: "#D9A63C",
    bg: "rgba(214,158,46,0.16)",
    border: "rgba(214,158,46,0.32)",
    text: "#E8C87E",
    label: "Medium",
  },
  low: {
    dot: "#4FC49A",
    bg: "rgba(45,180,140,0.16)",
    border: "rgba(45,180,140,0.30)",
    text: "#86D8B7",
    label: "Low",
  },
} as const;

/**
 * Acoustic visualization ink.
 *
 * The spectrum chart renders on canvas, so it cannot resolve CSS custom
 * properties; these are the console's existing values (specialist.css, STATUS,
 * ACCENT) expressed once so the plot is drawn from the same palette as the
 * surrounding workspace. Bars sit at a low alpha so the plot reads as part of
 * the glass surface, clinical status is carried by the bar tint and the
 * envelope line, and interaction (playhead, centroid) always uses lavender.
 * No glass material value is defined here.
 */
export const CHART = {
  dark: {
    stage:
      "linear-gradient(180deg, rgba(203,186,232,0.075) 0%, rgba(203,186,232,0.022) 58%, rgba(150,136,186,0.050) 100%)",
    grid: "rgba(232,226,248,0.085)",
    gridSoft: "rgba(232,226,248,0.055)",
    axis: "rgba(226,219,244,0.60)",
    centroid: "rgba(203,186,232,0.55)",
    label: "#D8CBEF",
    playhead: "rgba(223,204,247,0.85)",
    hoverInk: "#F4F1FA",
    barBase: 0.12,
    barRange: 0.3,
    bars: { urgent: "226,132,145", normal: "110,199,178", monitor: "198,182,232" },
    line: { urgent: "#F2A4AE", normal: "#86D8B7", monitor: "#D8CBEF" },
  },
  light: {
    stage:
      "linear-gradient(180deg, rgba(97,61,141,0.055) 0%, rgba(97,61,141,0.016) 58%, rgba(97,61,141,0.038) 100%)",
    grid: "rgba(35,30,44,0.10)",
    gridSoft: "rgba(35,30,44,0.065)",
    axis: "rgba(35,30,44,0.58)",
    centroid: "rgba(97,61,141,0.40)",
    label: "#564D60",
    playhead: "rgba(97,61,141,0.75)",
    hoverInk: "#231E2C",
    barBase: 0.1,
    barRange: 0.26,
    bars: { urgent: "178,74,88", normal: "38,132,110", monitor: "97,61,141" },
    line: { urgent: "#9C263C", normal: "#116449", monitor: "#613D8D" },
  },
} as const;

export type PriorityTone = keyof typeof STATUS;

/**
 * Page-level layout metrics measured off the approved reference at 1672x941.
 * The content band is 1592px wide inside 40px gutters, the queue column is 398px
 * and the workspace card fills the rest; the two columns share a bottom edge.
 */
export const LAYOUT = {
  maxWidth: 1680,
  pagePaddingX: 40,
  queueWidth: 398,
  headerHeight: 104,
  cardRadius: 26,
  gutter: 24,
  /** Gap between the masthead and the first line of the page title. */
  contentTop: 26,
  /** Space under the cards before the viewport edge. */
  contentBottom: 68,
  /** Right-hand clinical rail (outer width incl. its own padding). */
  railWidth: 470,
  railPaddingX: 34,
} as const;
