import { describe, expect, it } from "vitest";

// Imported directly rather than through `import.meta.glob`, which resolves the
// components fine but hands back an empty string for a stylesheet.
import indexCss from "../index.css?raw";
import tokensCss from "./tokens.css?raw";

/**
 * The focus indicator, guarded at the source.
 *
 * Three things went wrong here at once, and none of them could fail a behavioural
 * test: the app renders correctly in every case, it is only unusable for whoever
 * is driving it from a keyboard. So this reads the stylesheets and the components,
 * the way `brand.test.ts` and `confirm.test.ts` do.
 */

const sources = import.meta.glob("/src/**/*.{ts,tsx,css}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const read = (suffix: string) =>
  Object.entries(sources).find(([path]) => path.endsWith(suffix))?.[1] ?? "";

/** Comments talk *about* `outline-none`; only real classNames apply it. */
const withoutComments = (body: string) =>
  body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the focus ring is independent of the instance accent", () => {
  /**
   * The regression: the ring was `2px solid var(--stamp)`, and `--stamp` is set by
   * whoever runs the instance. An operator choosing `ACCENT_COLOR=#1a1a2e` got a
   * focus ring at 1.14:1 against their own page; `#0d0c10` got exactly 1:1. The
   * app looked fine and was unusable by keyboard, and no screenshot of the default
   * gold would ever have shown it.
   */
  it("draws the ring from its own tokens, never from --stamp", () => {
    // Every rule whose selector mentions focus-visible, matched whether the CSS
    // arrives formatted or minified. Slicing on a literal `":focus-visible {"`
    // was the earlier version of this, and it silently matched nothing the moment
    // a second selector joined the rule — passing locally against a cached build
    // of the CSS from before that change, and failing on a clean checkout.
    const rules = [...indexCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map(([, selector, body]) => ({ selector: selector.trim(), body }))
      .filter(({ selector }) => selector.includes("focus-visible"));

    expect(rules.length).toBeGreaterThan(0);
    for (const { selector, body } of rules) {
      expect(body, selector).not.toContain("--stamp");
    }
    expect(rules.some(({ body }) => body.includes("var(--focus-ring)")), "a ring").toBe(true);
    expect(rules.some(({ body }) => body.includes("var(--focus-halo)")), "a halo").toBe(true);
  });

  it("defines both tones in both themes", () => {
    const tokens = tokensCss;
    // Two of each: the dark block and the light one.
    expect(tokens.match(/--focus-ring:/g)).toHaveLength(2);
    expect(tokens.match(/--focus-halo:/g)).toHaveLength(2);
  });

  it("keeps the ring at two pixels, held off the element", () => {
    expect(indexCss).toMatch(/outline:\s*2px solid var\(--focus-ring\)/);
    expect(indexCss).toMatch(/outline-offset:\s*2px/);
  });
});

describe("no component opts out of the focus ring", () => {
  /**
   * `outline-none` was on the shared input base, which meant every text field,
   * number field, select and textarea in the app answered a keyboard focus with a
   * one-pixel border tint and nothing else.
   *
   * Two containers are allowed to keep it, and only those two: both are
   * `tabindex="-1"` regions that exist as a scroll destination for the skip link
   * and the settings tab panel. They are not in the tab sequence, which is what
   * WCAG 2.4.7 is about, and a ring around a full-width region reads as a border
   * rather than as focus.
   */
  const ALLOWED = ["/src/components/layout/AppShell.tsx", "/src/pages/Settings/index.tsx"];

  it("uses outline-none only on the two documented tabindex=-1 regions", () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.endsWith("/styles/focus.test.ts"))
      .filter(([path]) => !ALLOWED.some((allowed) => path.endsWith(allowed)))
      // A className, not the word inside a comment explaining why it is gone.
      .filter(([, body]) => /["'`][^"'`\n]*\boutline-none\b/.test(withoutComments(body)))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it("silences the halo wherever it silences the outline", () => {
    // `outline-none` kills the outline and leaves the box-shadow behind, so an
    // opt-out that forgets the halo gains a stray ring instead of losing one.
    for (const path of ALLOWED) {
      const body = read(path);
      const outlineOff = (body.match(/\boutline-none\b/g) ?? []).length;
      const haloOff = (body.match(/focus-visible:shadow-none/g) ?? []).length;
      expect(haloOff, path).toBe(outlineOff);
    }
  });
});

describe("scrolling rows leave room for the ring", () => {
  /**
   * Rails clip what leaves them, and a ring sitting 4px outside its element is the
   * first thing to go: every poster in every rail had its top edge cut off flat.
   */
  it("gives .rail its own focus room", () => {
    // Asserted against the whole stylesheet rather than a matched `.rail` block:
    // Tailwind splits the class across layers and a media query, so block-matching
    // finds only one of them. These four declarations exist for nothing else, so
    // their presence is the rule and their absence is its removal.
    expect(indexCss).toContain("--focus-room");
    // Both edges: a horizontal scroller clips top and bottom, and the first fix
    // covered only the top, which left the chip rows still cut off underneath.
    expect(indexCss).toMatch(/padding-top:\s*var\(--focus-room\)/);
    expect(indexCss).toMatch(/padding-bottom:\s*var\(--focus-room\)/);
    // Pulled back by the same amount, or every rail on the page moves.
    expect(indexCss).toMatch(/margin-top:\s*calc\(var\(--focus-room\)/);
    expect(indexCss).toMatch(/margin-bottom:\s*calc\(var\(--focus-room\)/);
  });

  /**
   * `.rail` owns the vertical spacing outright. A `pb-1.5` or `py-0.5` left in the
   * JSX is a Tailwind utility, which beats the component-layer rule and silently
   * takes the room away again — exactly how two rails still clipped after the
   * first attempt at this fix.
   */
  it("leaves no vertical padding utility on a rail to override it", () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => path.endsWith(".tsx"))
      .flatMap(([path, body]) =>
        [...body.matchAll(/["'`]([^"'`\n]*\brail\b[^"'`\n]*)["'`]/g)]
          .filter(([, cls]) => /\b(p[bty])-/.test(cls))
          .map(([, cls]) => `${path}: ${cls}`),
      );

    expect(offenders).toEqual([]);
  });
});
