import { describe, expect, it } from "vitest";

/**
 * An unknown address used to redirect silently to the dashboard, which looks
 * exactly like a link that worked — a stale bookmark, a renamed route and a typo
 * all read as "here is your library", and the person never learns their link is
 * broken.
 */
const sources = import.meta.glob("/src/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("an unknown address is not swallowed", () => {
  it("routes the catch-all to the not-found page rather than the dashboard", () => {
    const router = sources["/src/app/router.tsx"];
    expect(router).toContain("NotFoundPage");
    // The catch-all must not be a bare redirect home any more.
    expect(router).not.toMatch(/path="\*" element=\{<Navigate to="\/" replace \/>\}/);
  });

  it("still lets a post-sign-in landing through", () => {
    // The same catch-all is where a session lands the moment it authenticates,
    // because signing in does not move the browser off `/login`. Losing that
    // distinction would show "not found" to everybody who signs in.
    const router = sources["/src/app/router.tsx"];
    expect(router).toContain("POST_AUTH_PATHS");
    expect(router).toMatch(/POST_AUTH_PATHS[^\n]*"\/login"/);
  });

  it("consults a remembered destination only on a real landing", () => {
    // `takeReturnPath` answers the same value for the rest of the page load, so
    // asking it from an unknown address after a sign-in has already used one
    // would send somebody back to a page they had been sent to already, instead
    // of telling them the link is broken.
    const router = sources["/src/app/router.tsx"];
    const call = router.slice(router.indexOf("const [to] = useState"));
    expect(call.slice(0, 200)).toContain("POST_AUTH_PATHS.has");
  });
});

describe("the not-found page does not become a billboard", () => {
  it("shows the attempted address only when it reads as a path", () => {
    // It is the one piece of attacker-controlled text on the page: anybody can
    // send a link to any address. React escapes it, so this is not about markup
    // — it is about refusing to render "call this number to fix your account".
    const page = sources["/src/pages/NotFound/index.tsx"];
    expect(page).toContain("showable(location.pathname)");
    expect(page).toContain("MAX_SHOWN");
  });

  it("offers the three ways out the page promises", () => {
    const page = sources["/src/pages/NotFound/index.tsx"];
    for (const to of ['to="/"', 'to="/list/current"', 'to="/search"']) {
      expect(page, to).toContain(to);
    }
  });
});
