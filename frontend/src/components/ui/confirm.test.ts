import { describe, expect, it } from "vitest";

import en from "../../locales/en.json";

/**
 * The regression this file exists for: removing a title used to go through
 * `window.confirm`, which asks "Remove this title from your list?" over an "OK"
 * button and cannot say which title, what goes with it, or that a journal is
 * about to be deleted too.
 *
 * A behavioural test cannot catch it coming back, because the failure is not a
 * wrong answer — it is a component reaching past the design system for the
 * browser's dialog. So this reads the source instead, the way `brand.test.ts`
 * does, and fails on the next run rather than after someone ships it.
 */
describe("no destructive action falls back to the browser's dialog", () => {
  const sources = import.meta.glob("/src/**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("calls neither confirm() nor alert() anywhere in the app", () => {
    const offenders = Object.entries(sources)
      // Test files are excluded rather than just this one: the concern is
      // production code reaching for the browser dialog, and a test that
      // names `alert(` in an XSS payload string is not that.
      .filter(([path]) => !path.includes(".test."))
      // A bare call, not `setConfirming(` or `props.confirmLabel`: the leading
      // boundary is what separates `confirm(` from every identifier ending in it.
      .filter(([, body]) => /(?<![\w.])(?:window\.)?(?:confirm|alert)\s*\(/.test(body))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});

/**
 * The dialog promises specific things about what a delete takes with it. Those
 * sentences are only worth having if they are true, and the cascades they
 * describe are pinned on the backend by `test_deleting_an_entry_takes_it_off_
 * every_shelf` and `test_deleting_a_title_takes_its_journal_with_it`. What is
 * checked here is the half those cannot see: that the copy still exists, still
 * names the object, and has not drifted back to something generic.
 */
describe("destructive copy names what it is about to destroy", () => {
  it("interpolates the object into every confirmation heading", () => {
    const headings = [
      en.entry.removeTitle,
      en.shelf.deleteTitle,
      en.watch.leaveTitle,
      en.watch.closeTitle,
      en.settings.deleteUserTitle,
      en.friends.removeTitle,
      en.journal.deleteTitle,
    ];
    for (const heading of headings) {
      expect(heading, heading).toMatch(/\{\{\w+\}\}/);
    }
  });

  it("spells out the three things a removed title takes with it", () => {
    const affected = [
      en.entry.removeAffected1,
      en.entry.removeAffected2,
      en.entry.removeAffected3,
    ].join(" ");
    expect(affected).toMatch(/progress/i);
    expect(affected).toMatch(/journal/i);
    expect(affected).toMatch(/shelf|shelves/i);
  });
});
