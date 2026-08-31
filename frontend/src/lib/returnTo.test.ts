import { describe, expect, it } from "vitest";

import { DEFAULT_ROUTE, safeReturnPath } from "./returnTo";

/**
 * Anything that decides where a freshly authenticated session lands is a redirect
 * target. An open one is a phishing primitive: hand somebody a link, they sign in
 * to the real instance, and land on a copy of it that asks for the password again.
 * These are the cases that must not get through.
 */
describe("safeReturnPath rejects anything that leaves this origin", () => {
  it("refuses an absolute url", () => {
    for (const bad of [
      "https://evil.example",
      "http://evil.example/media",
      "HTTPS://EVIL.EXAMPLE",
      "ftp://evil.example",
    ]) {
      expect(safeReturnPath(bad), bad).toBeNull();
    }
  });

  it("refuses a protocol-relative url, which reads like a path and is not", () => {
    // The classic: `//evil.example` inherits the current scheme and navigates off
    // the origin entirely, while passing any check that only looks for a slash.
    for (const bad of ["//evil.example", "///evil.example", "//evil.example/media/1"]) {
      expect(safeReturnPath(bad), bad).toBeNull();
    }
  });

  it("refuses the backslash variants browsers normalise into slashes", () => {
    for (const bad of ["/\\evil.example", "/\\/evil.example", "\\\\evil.example"]) {
      expect(safeReturnPath(bad), bad).toBeNull();
    }
  });

  it("refuses a scheme wearing a path's clothes", () => {
    for (const bad of ["/javascript:alert(1)", "/data:text/html,x", "javascript:alert(1)"]) {
      expect(safeReturnPath(bad), bad).toBeNull();
    }
  });

  it("refuses control characters, which are how a scheme gets smuggled past", () => {
    expect(safeReturnPath("/\tjavascript:alert(1)")).toBeNull();
    expect(safeReturnPath("/\njavascript:alert(1)")).toBeNull();
    expect(safeReturnPath("/media /1")).toBeNull();
  });

  it("refuses anything that is not a string", () => {
    for (const bad of [null, undefined, 42, {}, [], true]) {
      expect(safeReturnPath(bad), String(bad)).toBeNull();
    }
  });

  it("refuses a relative path, which has no defined meaning here", () => {
    for (const bad of ["media/1", "../admin", ""]) {
      expect(safeReturnPath(bad), bad).toBeNull();
    }
  });
});

describe("safeReturnPath keeps a real destination whole", () => {
  it("accepts the routes a shared link actually points at", () => {
    for (const good of [
      "/media/anilist/21",
      "/u/taro",
      "/list/current",
      "/shelf/3",
      "/journal",
      "/friends",
    ]) {
      expect(safeReturnPath(good), good).toBe(good);
    }
  });

  it("keeps the query string, which carries which kind of title this is", () => {
    // `?type=anime` is not decoration: without it the page cannot tell an anime
    // from a manga, which is most of the point of the link.
    expect(safeReturnPath("/media/anilist/21?type=anime")).toBe("/media/anilist/21?type=anime");
    expect(safeReturnPath("/search?q=frieren&type=manga")).toBe("/search?q=frieren&type=manga");
  });

  it("keeps the fragment", () => {
    expect(safeReturnPath("/settings#instance")).toBe("/settings#instance");
    expect(safeReturnPath("/media/anilist/21?type=anime#episodes")).toBe(
      "/media/anilist/21?type=anime#episodes",
    );
  });

  it("trims surrounding whitespace rather than rejecting over it", () => {
    expect(safeReturnPath("  /journal  ")).toBe("/journal");
  });
});

describe("safeReturnPath refuses destinations that make no sense", () => {
  it("refuses the sign-in page, which would be a loop", () => {
    expect(safeReturnPath("/login")).toBeNull();
    expect(safeReturnPath("/login?next=/media/1")).toBeNull();
  });

  it("refuses the setup wizard, which is not where a new session belongs", () => {
    expect(safeReturnPath("/setup")).toBeNull();
  });

  it("names a default for the caller to fall back to", () => {
    expect(DEFAULT_ROUTE).toBe("/");
    expect(safeReturnPath(DEFAULT_ROUTE)).toBe("/");
  });
});
