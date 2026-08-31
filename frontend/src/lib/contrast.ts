/**
 * Colour maths for the instance accent.
 *
 * The accent is the one colour an operator chooses, and the app paints a lot with
 * it: the fill behind a primary button and a notification badge, progress bars,
 * selection dots, and accent-coloured labels. Every one of those was drawn on the
 * assumption that whatever arrived would behave like the default gold — light
 * enough to carry dark text, bright enough to read against an ink page. Nothing
 * checked, and `text-ink-950` was written into the components by hand.
 *
 * So this works out, for a given accent, what can actually be read on it and what
 * it can be read against. Pure functions with no DOM: the settings form uses them
 * to warn before saving, `applyAccent` uses them to derive the tokens, and the
 * tests use them without a browser.
 */

/** WCAG AA for body text. */
export const TEXT_CONTRAST = 4.5;
/** WCAG 1.4.11 for a UI component or a graphical object — a bar, a dot, a border. */
export const UI_CONTRAST = 3;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: string): boolean {
  return HEX.test(value);
}

export function parseHex(hex: string): Rgb | null {
  if (!isHex(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 through 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)];
  const ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  // Two decimals: the extra precision is noise, and it makes a warning's number
  // stable enough to be worth showing someone.
  return Math.round(ratio * 100) / 100;
}

export function contrastHex(a: string, b: string): number {
  const [x, y] = [parseHex(a), parseHex(b)];
  if (!x || !y) return 1;
  return contrast(x, y);
}

// --- HSL, for moving a colour without losing what it is -----------------------

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function toHsl({ r, g, b }: Rgb): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
      : max === gn
        ? ((bn - rn) / d + 2) / 6
        : ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

export function fromHsl({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  };
}

// --- What the app needs to know ----------------------------------------------

/**
 * The two page grounds the accent has to survive. Taken from `tokens.css`, and
 * pinned by a test that fails if either moves — the assessment is only honest
 * while these are the colours actually behind the accent.
 */
export const GROUNDS = { dark: "#0d0c10", light: "#f1ece1" } as const;

/** The two things text on an accent fill can be. Also from `tokens.css`. */
export const INKS = { dark: "#0d0c10", light: "#f1ece1" } as const;

/**
 * Whichever of ink and paper can actually be read on this accent.
 *
 * This is the function the components used to inline as `text-ink-950`: correct
 * for the default gold and wrong for anything dark, where it painted near-black
 * text on a near-black button.
 */
export function readableInk(accent: string): { color: string; ratio: number } {
  const rgb = parseHex(accent);
  if (!rgb) return { color: INKS.dark, ratio: 1 };
  const dark = contrastHex(accent, INKS.dark);
  const light = contrastHex(accent, INKS.light);
  return dark >= light ? { color: INKS.dark, ratio: dark } : { color: INKS.light, ratio: light };
}

/**
 * An accent-coloured *text* colour that can be read on a given ground.
 *
 * The submitted colour is kept when it already reads; otherwise its lightness is
 * walked toward the far end until it does, holding hue and saturation so the
 * result is still recognisably the operator's colour. This is what `--stamp-text`
 * becomes: gold-on-ink at the default, and the nearest legible version of
 * whatever else is chosen.
 */
export function readableOn(accent: string, ground: string, target = TEXT_CONTRAST): string {
  const rgb = parseHex(accent);
  if (!rgb) return accent;
  if (contrastHex(accent, ground) >= target) return accent;

  const groundRgb = parseHex(ground);
  if (!groundRgb) return accent;
  const hsl = toHsl(rgb);
  // Away from the ground: darken on paper, lighten on ink.
  const step = luminance(groundRgb) > 0.5 ? -0.02 : 0.02;

  let best = accent;
  let bestRatio = contrastHex(accent, ground);
  for (let i = 1; i <= 50; i++) {
    const l = Math.max(0, Math.min(1, hsl.l + step * i));
    const candidate = toHex(fromHsl({ ...hsl, l }));
    const ratio = contrastHex(candidate, ground);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= target) return candidate;
    if (l === 0 || l === 1) break;
  }
  // Nothing on this hue reaches the target; the closest attempt still beats
  // returning something known to be worse.
  return best;
}

/** One theme's verdict, judged on what the app will actually paint. */
export interface ThemeVerdict {
  /** The accent after derivation — what `--stamp` becomes in this theme. */
  fill: string;
  /**
   * True when the fill is not the submitted colour. Derivation is what keeps a
   * dark accent visible on a dark page, but it can move a colour a long way, and
   * an operator should be told that rather than discovering it on the page.
   */
  fillAdjusted: boolean;
  /** That fill against this theme's page. */
  uiRatio: number;
  uiPasses: boolean;
  /** Ink or paper, whichever reads on the fill, and how well. */
  inkColor: string;
  inkRatio: number;
  inkPasses: boolean;
  /** The accent as text on the page, and whether it had to be moved to get there. */
  textColor: string;
  textAdjusted: boolean;
}

export interface AccentVerdict {
  dark: ThemeVerdict;
  light: ThemeVerdict;
  /** The worst text-on-fill ratio across both themes — what the warning quotes. */
  ink: { ratio: number; passes: boolean };
  safe: boolean;
  /**
   * What is wrong, as translation keys, so the form can say it in the operator's
   * language rather than in a sentence assembled here.
   */
  problems: ("inkDark" | "inkLight" | "uiDark" | "uiLight")[];
}

function themeVerdict(accent: string, ground: string): ThemeVerdict {
  // Derived exactly as `applyAccent` derives it, so the verdict describes the
  // colour the app will paint rather than the one that was typed. Judging the raw
  // value instead would have the form warn about its own default gold, which is
  // 1.78:1 on paper as submitted and legible once darkened.
  const fill = readableOn(accent, ground, UI_CONTRAST);
  const uiRatio = contrastHex(fill, ground);
  const ink = readableInk(fill);
  const textColor = readableOn(accent, ground);

  return {
    fill,
    fillAdjusted: fill.toLowerCase() !== accent.toLowerCase(),
    uiRatio,
    uiPasses: uiRatio >= UI_CONTRAST,
    inkColor: ink.color,
    inkRatio: ink.ratio,
    inkPasses: ink.ratio >= TEXT_CONTRAST,
    textColor,
    textAdjusted: textColor.toLowerCase() !== accent.toLowerCase(),
  };
}

/**
 * Everything the settings form needs in order to decide whether to warn, checked
 * against both themes — an operator picks a colour in whichever one they happen to
 * be using, and their users are in the other half the time.
 *
 * What is left after derivation is a genuinely bad colour: a hue whose every shade
 * dissolves into one of the two pages, or a mid-tone that neither black nor white
 * can be read on.
 */
export function assessAccent(accent: string): AccentVerdict {
  const dark = themeVerdict(accent, GROUNDS.dark);
  const light = themeVerdict(accent, GROUNDS.light);

  const problems: AccentVerdict["problems"] = [];
  if (!dark.uiPasses) problems.push("uiDark");
  if (!light.uiPasses) problems.push("uiLight");
  if (!dark.inkPasses) problems.push("inkDark");
  if (!light.inkPasses) problems.push("inkLight");

  return {
    dark,
    light,
    ink: {
      ratio: Math.min(dark.inkRatio, light.inkRatio),
      passes: dark.inkPasses && light.inkPasses,
    },
    safe: problems.length === 0,
    problems,
  };
}

/**
 * The nearest colour of the same hue that passes everything.
 *
 * Lightness only, and searched outward from where the operator put it, so the
 * suggestion is recognisably the colour they asked for rather than a different
 * one. Null when the hue cannot satisfy every rule at any lightness — which
 * happens, and is better said plainly than papered over with a colour they did
 * not choose and would not recognise.
 */
export function nearestSafeAccent(accent: string): string | null {
  const rgb = parseHex(accent);
  if (!rgb) return null;
  if (assessAccent(accent).safe) return accent;

  const hsl = toHsl(rgb);
  // 1% steps out from the original in both directions, nearest first.
  for (let i = 1; i <= 100; i++) {
    for (const direction of [1, -1]) {
      const l = hsl.l + direction * i * 0.01;
      if (l < 0 || l > 1) continue;
      const candidate = toHex(fromHsl({ ...hsl, l }));
      if (assessAccent(candidate).safe) return candidate;
    }
  }
  return null;
}
