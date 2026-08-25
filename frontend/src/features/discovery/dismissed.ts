import { useCallback, useState } from "react";

/**
 * Titles the reader has waved away, so a suggestion turned down stays turned down.
 *
 * Kept in `localStorage`, the same way a declined season prompt is: this is a
 * preference about what to be shown, not a fact about the library, and putting it
 * in the database would mean a migration and a table for a list of strings. The
 * cost is that it is per-browser -- dismiss something on a phone and the desktop
 * still offers it. That is the honest tradeoff of the simpler thing, and the place
 * to revisit if it ever annoys anyone.
 */
const KEY = "anitrack-discovery-dismissed";

/** Old dismissals fall off the end rather than growing without limit. */
const KEEP = 200;

function read(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function write(keys: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys.slice(-KEEP)));
  } catch {
    /* private mode: the suggestion simply comes back next time */
  }
}

export function useDismissed() {
  const [keys, setKeys] = useState<string[]>(read);

  const dismiss = useCallback((key: string) => {
    setKeys((current) => {
      const next = [...new Set([...current, key])];
      write(next);
      return next;
    });
  }, []);

  const restore = useCallback(() => {
    write([]);
    setKeys([]);
  }, []);

  return { dismissed: new Set(keys), count: keys.length, dismiss, restore };
}
