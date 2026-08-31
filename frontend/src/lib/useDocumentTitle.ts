import { useEffect } from "react";

import { DEFAULT_INSTANCE_NAME } from "./brand";
import { useInstance } from "../features/instance/useInstance";

/**
 * Names the tab after the page you are actually on.
 *
 * The title was set once, to the instance name, and never again — so every tab,
 * every history entry and every bookmark of this app said the same word. Ten open
 * tabs were ten identical labels, the back button offered a list with nothing to
 * pick from, and a screen reader announced the same thing on arriving at every
 * route. An installed PWA had nothing else to orient by at all.
 *
 * `segment` is the page's own half; the instance's name is appended by this hook
 * so a renamed instance renames every title at once and no page has to know what
 * the app is called.
 *
 * Passing `undefined` is how a page says "not yet" — while a title is loading, or
 * when the request for it failed. That deliberately falls back to the instance
 * name alone rather than keeping whatever was there before: a tab still showing
 * the last title while a different page is on screen is worse than a generic one,
 * because it is confidently wrong.
 */
export function useDocumentTitle(segment?: string | null): void {
  const { data: instance } = useInstance();
  const name = instance?.instance_name || DEFAULT_INSTANCE_NAME;

  useEffect(() => {
    document.title = segment ? `${segment} · ${name}` : name;
  }, [segment, name]);
}
