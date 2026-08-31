import { describe, expect, it } from "vitest";

/**
 * The dashboard makes a run of decisions on somebody's behalf before it ever shows
 * them their own titles. Two things kept it honest and are guarded here.
 */
const sources = import.meta.glob("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("the decision area asks its question once", () => {
  it("keeps the heading on the dashboard, not inside NextUp", () => {
    // Both used to carry a `SectionHead` reading `recap.heading`, so the page asked
    // "what next" twice — and the inner one could render over nothing at all,
    // because the recap line survives when the suggestions do not.
    expect(sources["/src/components/media/NextUp.tsx"]).not.toContain("SectionHead");
    expect(sources["/src/pages/Dashboard/index.tsx"]).toContain("recap.heading");
  });
});

describe("sections can be put away and brought back", () => {
  const dash = sources["/src/pages/Dashboard/index.tsx"];

  it("guards every hideable section on the preference", () => {
    for (const id of ["tonight", "schedule", "inProgress", "recent", "friends"]) {
      expect(dash, id).toContain(`isHidden("${id}")`);
      expect(dash, id).toContain(`hide("${id}")`);
    }
  });

  it("offers a way back whenever anything has been changed", () => {
    // A preference you cannot reverse is a trap.
    expect(dash).toContain("customised");
    expect(dash).toContain("reset");
  });

  it("keeps the hero out of it", () => {
    // The page's answer to the question the page exists to ask. Hidden, the
    // dashboard is a blank one.
    expect(dash).not.toContain('isHidden("hero")');
  });

  it("remembers per user, not per browser", () => {
    // Two accounts sharing a laptop is the ordinary case on a self-hosted
    // instance; one person's tidied dashboard must not rearrange the other's.
    const hook = sources["/src/features/dashboard/useDashboardPrefs.ts"];
    expect(hook).toMatch(/dashboard:\$\{userId\}/);
    expect(hook).toContain("useMe");
  });
});

describe("customisation is offered, never imposed", () => {
  const hook = sources["/src/features/dashboard/useDashboardPrefs.ts"];

  it("ships a curated arrangement and stores nothing until something changes", () => {
    expect(hook).toContain("DEFAULT_ORDER");
    // Reset removes the key rather than writing the defaults into it, so an
    // account that resets is indistinguishable from one that never customised —
    // including after a release that changes what the recommended order is.
    expect(hook).toContain("removeItem");
  });

  it("repairs an order that predates a new section", () => {
    // A saved order simply would not mention a section added later, which would
    // leave it permanently invisible to everybody who had ever customised.
    expect(hook).toContain("DEFAULT_ORDER.filter((id) => !savedOrder.includes(id))");
  });

  it("keeps the figures out of the reorderable set", () => {
    // A band of numbers between two poster rails is not an arrangement anybody
    // wants; it can be hidden, it does not move.
    expect(hook).toContain("FIXED_SECTIONS");
    expect(hook).not.toMatch(/DEFAULT_ORDER[^=]*=[^;]*"stats"/);
  });
});
