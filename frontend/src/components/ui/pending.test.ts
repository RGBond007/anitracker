import { describe, expect, it } from "vitest";

/**
 * The two things that went wrong with in-flight state, guarded at the source
 * because neither shows up as a wrong answer.
 *
 * Twenty buttons were written as `disabled={mutation.isPending}` and nothing
 * else. That says "you cannot press this" without saying why, and to a screen
 * reader says less than nothing — a disabled control is simply skipped. Worse, it
 * does not actually prevent a second press: the flag only turns true once React
 * has re-rendered, and three clicks dispatched in one tick all run before that.
 * Measured against a slow write, that sent the same PUT three times.
 */
const sources = import.meta.glob("/src/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const withoutComments = (body: string) =>
  body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("in-flight state goes through the Button's own prop", () => {
  /**
   * The exceptions, each a control where a pending label would be wrong rather
   * than missing: `+1` is the highest-frequency action in the app and fires no
   * toast for the same reason, a reaction toggle is the same shape, and the
   * shelf's reorder arrows are icon-only — there is no label on a chevron to
   * swap. Changing any of them mid-press would flicker under the pointer.
   */
  const HIGH_FREQUENCY = /\b(increment|react|reorder)\.isPending\b/;

  /**
   * A handful of controls are raw `<button>` elements rather than the shared
   * component — an icon-only invite, a shelf toggle — so they cannot take the
   * prop. They carry `aria-busy` themselves instead, which is the half that
   * matters to assistive technology, and are recognised here by that.
   */
  const CARRIES_BUSY = /aria-busy/;

  it("never leaves a mutation button with only `disabled` to show for itself", () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.includes(".test."))
      .flatMap(([path, body]) => {
        const clean = withoutComments(body);
        return [...clean.matchAll(/disabled=\{[^}]*?(\w+)\.isPending[^}]*\}/g)]
          .filter((m) => !HIGH_FREQUENCY.test(m[0]))
          // The next line is where a raw button declares itself busy.
          .filter((m) => !CARRIES_BUSY.test(clean.slice(m.index, m.index + 160)))
          .map((m) => `${path}: ${m[0]}`);
      });

    expect(offenders).toEqual([]);
  });

  it("keeps the latch and the busy flag on the shared Button", () => {
    // Both live in one place so that no call site has to remember them. The ref
    // is the part that matters: state is too slow to stop the second click.
    const button = sources["/src/components/ui/Button.tsx"];
    expect(button).toContain("aria-busy");
    expect(button).toContain("firedRef");
    // Released when the request finishes, however it finishes — a failed save
    // has to be repeatable.
    expect(button).toMatch(/useEffect\(\(\) => \{\s*if \(!pending\) firedRef\.current = false;/);
  });
});

describe("a failed mutation is announced", () => {
  it("marks every mutation error display as an alert", () => {
    // A failure that only appears is not announced: the person who pressed the
    // button gets no signal at all that the thing did not happen.
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.includes(".test."))
      .flatMap(([path, body]) => {
        const clean = withoutComments(body);
        return [...clean.matchAll(/<p([^>]*)>\s*\{?\s*errorMessage\(/g)]
          .filter((m) => !m[1].includes('role="alert"'))
          .map(() => path);
      });

    expect(offenders).toEqual([]);
  });
});
