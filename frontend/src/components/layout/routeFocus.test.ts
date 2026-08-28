import { describe, expect, it } from "vitest";

import { movesFocusToMain } from "./routeFocus";

/**
 * The skip link only helps on a tab pass that starts at the top of the document.
 * Follow a nav link and focus stays on the link, the rest of the header ahead of
 * the content and the skip link behind — measured at eight tab stops between the
 * "Journal" link and the first control on the journal page. So the shell moves
 * focus itself, and these are the cases where it must not.
 */
describe("movesFocusToMain", () => {
  it("moves focus when a link goes somewhere new", () => {
    expect(movesFocusToMain("/", "/journal", "PUSH")).toBe(true);
    expect(movesFocusToMain("/journal", "/friends", "PUSH")).toBe(true);
  });

  it("moves focus on Back and Forward, which are navigations too", () => {
    expect(movesFocusToMain("/journal", "/", "POP")).toBe(true);
  });

  it("leaves focus alone when a page rewrites its own address", () => {
    // The season switcher: same screen, same controls, one of which the user
    // still has their hand on. `replace` is how it avoids filling up history.
    expect(movesFocusToMain("/media/anilist/16498", "/media/anilist/25777", "REPLACE")).toBe(false);
  });

  it("leaves focus alone when nothing about the address changed", () => {
    // Includes the first render: the shell seeds its record with the current
    // path, so a mount is never seen as a change and never lands past the link.
    expect(movesFocusToMain("/journal", "/journal", "POP")).toBe(false);
    expect(movesFocusToMain("/journal", "/journal", "PUSH")).toBe(false);
  });

  it("ignores the query string, which is not a new destination", () => {
    // `useLocation().pathname` excludes it by construction — pinned here because
    // switching a title between anime and manga only moves `?type=`.
    expect(movesFocusToMain("/media/anilist/21", "/media/anilist/21", "PUSH")).toBe(false);
  });
});
