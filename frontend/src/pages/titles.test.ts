import { describe, expect, it } from "vitest";

/**
 * Every page names the tab it is in.
 *
 * The title was set once, to the instance name, and never again — so ten open
 * tabs were ten identical labels, the back button offered a history with nothing
 * to distinguish its entries, and a screen reader announced the same word on
 * arriving at every route.
 *
 * A source scan because the failure mode is a *new* page that forgets: it renders
 * perfectly and silently inherits whatever title the previous route left behind,
 * which is the one outcome worse than a generic title.
 */
const pages = import.meta.glob("/src/pages/*/index.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("every route names itself", () => {
  it("calls useDocumentTitle from every page", () => {
    const silent = Object.entries(pages)
      .filter(([, body]) => !body.includes("useDocumentTitle("))
      .map(([path]) => path);

    expect(silent).toEqual([]);
  });

  it("covers every page the router mounts", () => {
    // Guards the glob itself: a pattern that stops matching would make the test
    // above pass by finding nothing at all.
    expect(Object.keys(pages).length).toBeGreaterThanOrEqual(13);
  });
});

describe("the title is composed in one place", () => {
  const sources = import.meta.glob("/src/**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("assigns document.title only in the hook", () => {
    // The router used to set it too, which made the winner depend on which effect
    // happened to run last.
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.endsWith("/lib/useDocumentTitle.ts") && !path.includes(".test."))
      .filter(([, body]) =>
        body
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "")
          .includes("document.title"),
      )
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it("appends the instance name rather than hardcoding one", () => {
    // A renamed instance has to rename every title at once, and no page should
    // know what the app is called.
    const hook = sources["/src/lib/useDocumentTitle.ts"];
    expect(hook).toContain("instance?.instance_name");
    expect(hook).toContain("DEFAULT_INSTANCE_NAME");
    // Falls back to the bare instance name while a title is unknown, so a tab
    // never keeps the last one it saw.
    expect(hook).toMatch(/segment \? `\$\{segment\} · \$\{name\}` : name/);
  });
});
