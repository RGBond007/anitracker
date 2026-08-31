import { describe, expect, it } from "vitest";

import {
  GROUNDS,
  INKS,
  TEXT_CONTRAST,
  UI_CONTRAST,
  assessAccent,
  contrastHex,
  fromHsl,
  luminance,
  nearestSafeAccent,
  parseHex,
  readableInk,
  readableOn,
  toHex,
  toHsl,
} from "./contrast";

/**
 * The accent is the one colour an operator chooses, and until now nothing checked
 * what it made unreadable. `text-ink-950` was written into the button, the badge
 * and the cropper by hand, which is correct for the default gold and paints
 * near-black text on a near-black button for anything dark.
 */

describe("the maths agrees with the WCAG worked examples", () => {
  it("puts black against white at 21:1", () => {
    expect(contrastHex("#000000", "#ffffff")).toBe(21);
  });

  it("puts a colour against itself at 1:1", () => {
    expect(contrastHex("#d4af37", "#d4af37")).toBe(1);
  });

  it("computes the reference luminances", () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  it("refuses anything that is not a six-digit hex", () => {
    for (const bad of ["", "#fff", "d4af37", "#gggggg", "#d4af3", "rgb(1,2,3)"]) {
      expect(parseHex(bad), bad).toBeNull();
    }
    expect(parseHex("#D4AF37")).toEqual({ r: 212, g: 175, b: 55 });
  });
});

describe("hsl survives the round trip", () => {
  it("returns the colour it was given", () => {
    for (const hex of ["#d4af37", "#0d0c10", "#f1ece1", "#00c853", "#1a1a2e", "#7f7f7f"]) {
      expect(toHex(fromHsl(toHsl(parseHex(hex)!))), hex).toBe(hex);
    }
  });

  it("handles grey, which has no hue to preserve", () => {
    expect(toHex(fromHsl(toHsl({ r: 128, g: 128, b: 128 })))).toBe("#808080");
  });
});

describe("readableInk picks the text that can be read on the accent", () => {
  it("keeps dark text on the default gold, which is what the app already drew", () => {
    const { color, ratio } = readableInk("#d4af37");
    expect(color).toBe(INKS.dark);
    expect(ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it("switches to light text on a dark accent", () => {
    // The regression: `text-ink-950` on `bg-stamp` here is #0d0c10 on #1a1a2e —
    // a button whose label is invisible.
    expect(readableInk("#1a1a2e").color).toBe(INKS.light);
    expect(readableInk("#4a148c").color).toBe(INKS.light);
  });

  it("keeps dark text on a bright accent", () => {
    expect(readableInk("#00c853").color).toBe(INKS.dark);
    expect(readableInk("#ffeb3b").color).toBe(INKS.dark);
  });

  it("always returns the better of the two, whichever that is", () => {
    for (const accent of ["#d4af37", "#1a1a2e", "#00c853", "#808080", "#4a148c"]) {
      const chosen = readableInk(accent);
      const other = chosen.color === INKS.dark ? INKS.light : INKS.dark;
      expect(chosen.ratio, accent).toBeGreaterThanOrEqual(contrastHex(accent, other));
    }
  });
});

describe("readableOn moves a colour only as far as it has to", () => {
  it("leaves a colour that already reads exactly as submitted", () => {
    // The operator's own colour, preserved: the point is to keep the brand where
    // keeping it is safe.
    const alreadyFine = "#e4c158";
    expect(contrastHex(alreadyFine, GROUNDS.dark)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(readableOn(alreadyFine, GROUNDS.dark)).toBe(alreadyFine);
  });

  it("lightens against ink and darkens against paper", () => {
    const dark = "#3b2f0b";
    const onInk = readableOn(dark, GROUNDS.dark);
    expect(luminance(parseHex(onInk)!)).toBeGreaterThan(luminance(parseHex(dark)!));

    const bright = "#ffeb3b";
    const onPaper = readableOn(bright, GROUNDS.light);
    expect(luminance(parseHex(onPaper)!)).toBeLessThan(luminance(parseHex(bright)!));
  });

  it("reaches the target on both grounds for a range of hues", () => {
    for (const accent of ["#d4af37", "#00c853", "#1a1a2e", "#c62828", "#1565c0", "#ffeb3b"]) {
      for (const ground of [GROUNDS.dark, GROUNDS.light]) {
        expect(contrastHex(readableOn(accent, ground), ground), `${accent} on ${ground}`)
          .toBeGreaterThanOrEqual(TEXT_CONTRAST);
      }
    }
  });

  it("keeps the hue, so the result is still the operator's colour", () => {
    const accent = "#1565c0";
    const moved = readableOn(accent, GROUNDS.dark);
    expect(toHsl(parseHex(moved)!).h).toBeCloseTo(toHsl(parseHex(accent)!).h, 2);
  });
});

describe("assessAccent judges what the app will paint, not what was typed", () => {
  it("passes the default gold", () => {
    // As submitted, gold is 1.78:1 on paper — the form must not warn about the
    // app's own default. It is judged on the darkened fill the light theme will
    // actually draw, which is legible.
    const v = assessAccent("#d4af37");
    expect(v.safe).toBe(true);
    expect(v.problems).toEqual([]);
    expect(v.dark.fill).toBe("#d4af37");
    expect(v.light.fillAdjusted).toBe(true);
  });

  it("keeps a colour untouched in the theme where it already works", () => {
    // Preserving the submitted colour wherever it is safe to: gold needs nothing
    // doing to it against ink.
    expect(assessAccent("#d4af37").dark.fillAdjusted).toBe(false);
  });

  it("rescues a near-black accent by lightening it against the dark page", () => {
    // Submitted at 1:1 against the dark page — invisible as a progress bar. The
    // fill is moved until it reads, and the operator is told it was moved.
    const v = assessAccent("#0d0c10");
    expect(v.dark.fillAdjusted).toBe(true);
    expect(v.dark.uiRatio).toBeGreaterThanOrEqual(UI_CONTRAST);
    expect(v.safe).toBe(true);
  });

  it("rescues a near-white accent against the light page", () => {
    const v = assessAccent("#fffdf7");
    expect(v.light.fillAdjusted).toBe(true);
    expect(v.light.uiRatio).toBeGreaterThanOrEqual(UI_CONTRAST);
  });

  it("checks both themes, not the one the operator happens to be in", () => {
    // This one looks fine in dark and needs work in light. An operator picking it
    // from a dark settings page would never see the problem.
    const v = assessAccent("#f5f0e3");
    expect(v.dark.fillAdjusted).toBe(false);
    expect(v.light.fillAdjusted).toBe(true);
  });

  it("fails a mid-tone, which no amount of derivation can fix", () => {
    // Neither black nor white reaches 4.5:1 on mid-grey, so a badge count drawn
    // on it is unreadable whichever ink is chosen. This is the case that has to
    // warn, because it cannot be solved by moving the lightness of the fill.
    const v = assessAccent("#767676");
    expect(v.safe).toBe(false);
    expect(v.problems).toContain("inkDark");
    expect(v.ink.passes).toBe(false);
  });

  it("always leaves text on the fill readable when it says it is safe", () => {
    for (const accent of ["#d4af37", "#0d0c10", "#1a1a2e", "#00c853", "#c62828", "#ffffff"]) {
      const v = assessAccent(accent);
      if (!v.safe) continue;
      for (const theme of ["dark", "light"] as const) {
        const side = v[theme];
        expect(contrastHex(side.inkColor, side.fill), `${accent} ${theme}`).toBeGreaterThanOrEqual(
          TEXT_CONTRAST,
        );
        expect(side.uiRatio, `${accent} ${theme}`).toBeGreaterThanOrEqual(UI_CONTRAST);
      }
    }
  });

  it("treats an unparseable colour as unsafe rather than throwing", () => {
    expect(assessAccent("not-a-colour").safe).toBe(false);
  });
});

describe("nearestSafeAccent suggests something recognisable", () => {
  it("returns the colour untouched when it is already safe", () => {
    expect(nearestSafeAccent("#d4af37")).toBe("#d4af37");
    expect(nearestSafeAccent("#00c853")).toBe("#00c853");
  });

  it("returns a colour that actually passes every check", () => {
    // Only genuine mid-tones survive derivation as failures, so those are what
    // the suggestion has to answer for.
    for (const accent of ["#767676", "#808080", "#8a8a8a", "#7f7f7f"]) {
      const safe = nearestSafeAccent(accent);
      expect(safe, accent).not.toBeNull();
      const v = assessAccent(safe!);
      expect(v.safe, `${accent} → ${safe}`).toBe(true);
      expect(v.ink.ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      expect(v.dark.uiRatio).toBeGreaterThanOrEqual(UI_CONTRAST);
      expect(v.light.uiRatio).toBeGreaterThanOrEqual(UI_CONTRAST);
    }
  });

  it("keeps the hue it was given", () => {
    const accent = "#767676";
    const safe = nearestSafeAccent(accent)!;
    expect(toHsl(parseHex(safe)!).h).toBeCloseTo(toHsl(parseHex(accent)!).h, 2);
  });

  it("answers null rather than inventing a colour nobody chose", () => {
    expect(nearestSafeAccent("bad")).toBeNull();
  });
});

/**
 * The verdicts are only honest while these are the colours actually behind the
 * accent. If a theme's ground moves in `tokens.css` and this is not updated, every
 * warning in the settings form starts describing a page that no longer exists.
 */
describe("the assumed grounds match the stylesheet", () => {
  it("uses the ink and paper the tokens define", async () => {
    const tokens = (await import("../styles/tokens.css?raw")).default;
    const value = (name: string) =>
      tokens.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();

    expect(value("--ink-950")).toBe(GROUNDS.dark);
    expect(value("--paper")).toBe(GROUNDS.light);
    expect(value("--ink-950")).toBe(INKS.dark);
    expect(value("--paper")).toBe(INKS.light);
  });
});
