import { describe, expect, it } from "vitest";

import { buildCrashReport, describeRoute, redact } from "./diagnostics";

/**
 * The acceptance test for the crash screen's one dangerous feature.
 *
 * The screen prints a stack trace and offers to copy it, and the person copying it
 * is by definition someone who has just been told the app broke — they will paste
 * it into a public issue without auditing it first. Every case below is a string
 * this app can genuinely produce: the session is a JWT, `ApiError.message` is the
 * server's own `detail`, and both can be stringified into a frame.
 */

const FACTS = {
  href: "https://anime.example.org/media/anilist/21",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  version: "2.6.0",
  at: "2026-08-26T09:14:02.000Z",
};

/** Shaped like the real one: three base64url segments after an `eyJ` header. */
const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImV4cCI6MTc2NzIyNTYwMH0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";

describe("redact", () => {
  it("removes a session token, named or bare", () => {
    expect(redact(`token=${JWT}`)).not.toContain(JWT);
    expect(redact(`failed with ${JWT} attached`)).not.toContain(JWT);
    expect(redact(`Authorization: Bearer ${JWT}`)).not.toContain(JWT);
  });

  it("removes anything that calls itself a credential, however it is punctuated", () => {
    const cases = [
      'password: "hunter2"',
      "password=hunter2",
      '{"secret":"s3cr3t-value"}',
      "api_key=ak_live_9f8e7d6c5b4a",
      "Cookie: session=abc123def456",
      "X-Api-Key: 0f9d8c7b6a5e4d3c",
    ];
    for (const text of cases) {
      const out = redact(text);
      expect(out, text).toContain("[redacted]");
      for (const secret of ["hunter2", "s3cr3t-value", "ak_live_9f8e7d6c5b4a", "abc123def456"]) {
        expect(out, text).not.toContain(secret);
      }
    }
  });

  it("removes the query string, which is where one-time links keep their secret", () => {
    const out = redact("GET https://anime.example.org/api/auth/verify?token=abc123&next=/ failed");
    expect(out).not.toContain("abc123");
    expect(out).toContain("https://anime.example.org/api/auth/verify?[redacted]");
  });

  it("removes an email address, the one identifier that names a person", () => {
    // The API really answers this way on a conflict, and it lands in `message`.
    const out = redact("ApiError: a user with email kaito@example.org already exists");
    expect(out).not.toContain("kaito@example.org");
    expect(out).toContain("[redacted]");
  });

  it("removes an unnamed opaque blob", () => {
    const blob = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0";
    expect(redact(`payload ${blob}`)).not.toContain(blob);
  });

  /**
   * The other half of the job. A report whose stack is entirely `[redacted]` is
   * worse than none: it cannot be acted on, and it teaches people to send a photo
   * of their console instead. These are the strings that must survive intact.
   */
  it("leaves the parts of a trace that make a crash fixable", () => {
    const trace = [
      "TypeError: Cannot read properties of undefined (reading 'title')",
      "    at Poster (https://anime.example.org/assets/index-C_HjmDAW.js:14:2210)",
      "    at PosterRow (https://anime.example.org/assets/index-C_HjmDAW.js:14:9004)",
      "    at /Users/someone/Git/homelab/anitracker/frontend/src/components/media/Poster.tsx:31:9",
    ].join("\n");
    expect(redact(trace)).toBe(trace);
  });

  it("leaves an ordinary sentence alone", () => {
    const message = "ApiError: Series has no seasons for this provider id";
    expect(redact(message)).toBe(message);
  });
});

describe("describeRoute", () => {
  it("keeps the path, which says which screen broke", () => {
    expect(describeRoute("https://anime.example.org/media/anilist/21")).toBe("/media/anilist/21");
  });

  it("keeps the hash route the static demo runs on", () => {
    expect(describeRoute("https://example.github.io/anitracker/#/journal")).toBe(
      "/anitracker/#/journal",
    );
  });

  it("drops a query string from either half, and says that it did", () => {
    expect(describeRoute("https://anime.example.org/search?q=frieren")).toBe(
      "/search (query omitted)",
    );
    expect(describeRoute("https://example.github.io/#/search?q=frieren")).toBe("/#/search");
  });

  it("answers rather than throws when handed something that is not a url", () => {
    expect(describeRoute("about:blank#")).not.toBe("");
    expect(describeRoute("nonsense")).toBe("(unknown)");
  });
});

describe("buildCrashReport", () => {
  it("names the version, the moment and the screen", () => {
    const report = buildCrashReport({ ...FACTS, error: new Error("boom") });
    expect(report).toContain("AniTracker 2.6.0");
    expect(report).toContain("2026-08-26T09:14:02.000Z");
    expect(report).toContain("/media/anilist/21");
  });

  it("carries the stack and the component stack", () => {
    const error = new Error("Cannot read properties of undefined");
    error.stack = "Error: Cannot read properties of undefined\n    at Poster (app.js:1:1)";
    const report = buildCrashReport({
      ...FACTS,
      error,
      componentStack: "\n    at Poster\n    at PosterRow\n",
    });
    expect(report).toContain("at Poster (app.js:1:1)");
    expect(report).toContain("Component stack:");
    expect(report).toContain("at PosterRow");
  });

  it("says the error once, not twice", () => {
    const error = new Error("boom");
    error.stack = "Error: boom\n    at somewhere";
    const report = buildCrashReport({ ...FACTS, error });
    expect(report.match(/boom/g)).toHaveLength(1);
  });

  it("redacts what the error message dragged in with it", () => {
    const report = buildCrashReport({
      ...FACTS,
      error: new Error(`request failed: Authorization: Bearer ${JWT}`),
    });
    expect(report).not.toContain(JWT);
  });

  it("reports something that was thrown but was never an Error", () => {
    expect(buildCrashReport({ ...FACTS, error: "boom" })).toContain("Non-error thrown: boom");
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    // The report is the last thing standing; it may not be the second crash.
    expect(() => buildCrashReport({ ...FACTS, error: circular })).not.toThrow();
  });

  it("stays short enough to be pasted into an issue", () => {
    const error = new Error("boom");
    error.stack = `Error: boom\n${"    at frame (app.js:1:1)\n".repeat(500)}`;
    const report = buildCrashReport({ ...FACTS, error });
    expect(report.length).toBeLessThan(4_100);
    expect(report).toContain("(truncated)");
  });
});
