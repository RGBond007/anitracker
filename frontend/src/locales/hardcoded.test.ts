import { describe, expect, it } from "vitest";

/**
 * Nothing a person reads may be written into a component.
 *
 * A source scan rather than a behavioural test, for the same reason `brand.test.ts`
 * is one: the failure is not a wrong answer but a string in the wrong file, and it
 * only shows itself to someone reading the app in the other language.
 */
const sources = import.meta.glob("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/**
 * English on purpose, both of them.
 *
 * The demo banner is scaffolding around the product that Vite drops from a real
 * instance's bundle. `diagnostics.ts` builds the crash screen's technical block,
 * which is pasted into a bug report — a developer artefact, and translating a
 * stack trace's framing would make it harder to act on, not easier to read.
 */
const ALLOWED = ["/src/demo/DemoBanner.tsx", "/src/lib/diagnostics.ts"];

const withoutComments = (body: string) =>
  body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const scan = (pattern: RegExp) =>
  Object.entries(sources)
    .filter(([path]) => !path.includes(".test.") && !ALLOWED.some((a) => path.endsWith(a)))
    .flatMap(([path, body]) =>
      [...withoutComments(body).matchAll(pattern)].map((m) => `${path}: ${m[0].slice(0, 60)}`),
    );

describe("no user-facing string is hardcoded", () => {
  it("routes every accessible name through the locale files", () => {
    // `aria-label="Close"` on the modal and the sheet was the reported case: read
    // out in English to a German screen-reader user, on every dialog in the app.
    const human = /(?:aria-label|placeholder|title)=["'][A-Z][A-Za-z][^"']*["']/g;
    expect(scan(human)).toEqual([]);
  });

  it("routes every toast through the locale files", () => {
    // Eight of these sat inside the mutation hooks that fired them.
    expect(scan(/\btoast\(\s*["'`][A-Z]/g)).toEqual([]);
  });

  it("never prints a raw error object at a person", () => {
    // `String(err)` on an ApiError yields "ApiError: <server detail>" — a class
    // name and an English string written in the Python source.
    expect(scan(/\bString\(\s*\w*\.?error\s*\)/g)).toEqual([]);
  });
});
