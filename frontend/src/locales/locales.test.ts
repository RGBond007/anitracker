import { describe, expect, it } from "vitest";

import de from "./de.json";
import en from "./en.json";

/**
 * The gaps this file exists for: the modal's close button was `aria-label="Close"`
 * in every language, eight mutation toasts were English string literals inside the
 * hooks that fired them, and every form printed `String(error)` — which on an
 * `ApiError` renders "ApiError: Not Found", a class name and a server-side English
 * string shown to whoever was using the app in German.
 */

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "string") out[prefix + key] = value;
    else Object.assign(out, flatten(value, `${prefix}${key}.`));
  }
  return out;
}

const flatEn = flatten(en as Tree);
const flatDe = flatten(de as Tree);

describe("the two locales describe the same app", () => {
  it("has no key in one that is missing from the other", () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatDe).sort());
  });

  it("leaves nothing empty", () => {
    for (const [key, value] of Object.entries(flatDe)) expect(value.trim(), key).not.toBe("");
    for (const [key, value] of Object.entries(flatEn)) expect(value.trim(), key).not.toBe("");
  });

  it("keeps every interpolation the English string uses", () => {
    // A dropped `{{name}}` is invisible until the sentence renders with a hole in
    // it, and only for whoever reads that language.
    const placeholders = (s: string) => (s.match(/\{\{\s*[\w.]+[^}]*\}\}/g) ?? [])
      .map((p) => p.replace(/[{}\s]/g, "").split(",")[0])
      .sort();
    for (const key of Object.keys(flatEn)) {
      expect(placeholders(flatDe[key]), key).toEqual(placeholders(flatEn[key]));
    }
  });
});

describe("counts are pluralised", () => {
  const plurals = [...new Set(
    Object.keys(flatEn).filter((k) => /_(one|other|zero)$/.test(k)).map((k) => k.replace(/_(one|other|zero)$/, "")),
  )];

  it("gives every pluralised key both forms in both languages", () => {
    for (const base of plurals) {
      // `season.kind_other` is a *kind* called "other", not a plural form — it is
      // looked up by an exact key and never with a count. The collision is real
      // but harmless, and excluding it here beats renaming a wire value.
      if (base === "season.kind" || base === "season.kindShort") continue;
      for (const form of ["_one", "_other"]) {
        expect(flatEn[base + form], `en ${base}${form}`).toBeDefined();
        expect(flatDe[base + form], `de ${base}${form}`).toBeDefined();
      }
    }
  });

  it("interpolates a count wherever it claims to be counting", () => {
    for (const base of plurals) {
      if (base.startsWith("season.kind")) continue;
      expect(flatEn[`${base}_other`], base).toContain("{{count}}");
    }
  });
});

describe("a failed request has something to say in either language", () => {
  it("carries a message for every status the mapping can produce", () => {
    // Kept in step with `errorKey`: a status mapped to a key nobody wrote is a
    // blank red line under a form.
    for (const key of ["badRequest", "unauthorized", "forbidden", "notFound", "conflict",
                       "tooLarge", "rateLimited", "server", "offline", "generic"]) {
      expect(flatEn[`error.${key}`], `en error.${key}`).toBeTruthy();
      expect(flatDe[`error.${key}`], `de error.${key}`).toBeTruthy();
    }
  });
});
