import { describe, expect, it } from "vitest";

import { BUILT_IN_BRAND_NAMES, DEFAULT_INSTANCE_NAME, usesBuiltInBrand } from "./brand";

/**
 * The regression this file exists for: the header and the login screen each had
 * their own copy of this rule, and one of them compared the same string twice, so
 * an instance named "AniTrack" showed the logo on one screen and a blank square on
 * the other. Both now call `usesBuiltInBrand`, and these cases pin its answers.
 */
describe("usesBuiltInBrand", () => {
  it("recognises both spellings of the built-in name", () => {
    expect(usesBuiltInBrand("AniTracker")).toBe(true);
    // The one the broken comparison missed, and the reason the logo vanished.
    expect(usesBuiltInBrand("AniTrack")).toBe(true);
  });

  it("treats every built-in name the same, whatever the list grows to", () => {
    for (const name of BUILT_IN_BRAND_NAMES) {
      expect(usesBuiltInBrand(name)).toBe(true);
    }
  });

  it("uses the built-in brand for the name the app falls back to", () => {
    expect(usesBuiltInBrand(DEFAULT_INSTANCE_NAME)).toBe(true);
  });

  it("does not claim the built-in brand for someone else's instance", () => {
    expect(usesBuiltInBrand("Kaito's Library")).toBe(false);
    expect(usesBuiltInBrand("")).toBe(false);
  });

  it("lets a custom logo win over any name", () => {
    expect(usesBuiltInBrand("AniTracker", "https://example.com/logo.png")).toBe(false);
    expect(usesBuiltInBrand("AniTrack", "https://example.com/logo.png")).toBe(false);
  });

  it("treats an empty logo url as no logo, which is what the API sends", () => {
    // `logo_url` is a string on the wire and is "" when unset, not undefined.
    expect(usesBuiltInBrand("AniTrack", "")).toBe(true);
    expect(usesBuiltInBrand("AniTrack", undefined)).toBe(true);
  });

  it("is case sensitive, so a look-alike name keeps its own identity", () => {
    expect(usesBuiltInBrand("anitracker")).toBe(false);
  });
});

/**
 * The behavioural tests above cannot catch what actually went wrong: the header
 * did not call a broken helper, it carried its own copy of the rule. So this one
 * reads the source instead and fails if a second copy appears anywhere.
 *
 * A source scan is an unusual test, and it is here because the failure it guards
 * against is duplication rather than logic. If someone writes the comparison
 * inline again, this says so on the next run instead of after a rename.
 *
 * Read through Vite's own `import.meta.glob` rather than `node:fs`, so the file
 * stays inside the browser-shaped type environment the rest of `src` compiles in
 * and `npm run lint` keeps passing without pulling in Node's types.
 */
describe("no component re-implements the brand rule", () => {
  it("compares against a built-in name in brand.ts and nowhere else", () => {
    const sources = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;

    const offenders = Object.entries(sources)
      .filter(([path]) => !path.endsWith("/lib/brand.ts") && !path.endsWith("/lib/brand.test.ts"))
      // Naming the app is fine — the demo's fake instance and the setup default
      // both do. What must not come back is a *comparison* against the name.
      .filter(([, body]) => /[=!]==\s*["'`]AniTrack(er)?["'`]/.test(body))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
