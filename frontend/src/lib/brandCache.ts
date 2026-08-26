import type { Instance } from "./api-client";

/**
 * The brand this browser saw the last time the instance answered.
 *
 * Every other screen falls back to the built-in name while `/instance` is in
 * flight, and that is fine because it lasts a frame. The startup screen is the
 * one place where it does not: it exists precisely because the request has not
 * come back yet, and on a NAS, a Raspberry Pi or a waking database that is the
 * several seconds a self-hoster is most likely to be staring at. An instance
 * called "Kaito's Library" should not spend them calling itself AniTracker.
 *
 * Only the name, the logo and the accent are kept — the three things the brand
 * is made of. All are already visible to anyone who can reach the login page,
 * and a stale one costs a single repaint once the real response lands.
 */
const KEY = "anitrack-brand";

export interface CachedBrand {
  instanceName: string;
  logoUrl: string;
  /** Empty means "this instance never set one" — see `applyAccent`. */
  accentColor: string;
}

/** The remembered brand, or null when there is nothing trustworthy to use. */
export function readCachedBrand(): CachedBrand | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Private mode and "block all cookies" throw on access rather than
    // answering null. Having no cache is a working state, so nothing to do.
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { instanceName, logoUrl, accentColor } = parsed as Partial<CachedBrand>;
    // A blank name would draw an empty screen, which is the thing this whole
    // feature exists to remove. Better to fall back to the built-in brand.
    if (typeof instanceName !== "string" || instanceName === "") return null;

    // The two optional halves are read defensively rather than rejected: a
    // cache written by an older version has a usable name and no accent, and a
    // named brand with the default colour still beats no brand at all.
    return {
      instanceName,
      logoUrl: typeof logoUrl === "string" ? logoUrl : "",
      accentColor: typeof accentColor === "string" ? accentColor : "",
    };
  } catch {
    // Written by an older version of this format, or by something else.
    return null;
  }
}

/** Remembers the brand for the next cold start. Never throws. */
export function cacheBrand(
  instance: Pick<Instance, "instance_name" | "logo_url" | "accent_color">,
): void {
  try {
    const next: CachedBrand = {
      instanceName: instance.instance_name,
      logoUrl: instance.logo_url ?? "",
      accentColor: instance.accent_color ?? "",
    };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Full quota, or a browser that refuses storage. The startup screen then
    // draws the built-in brand, which is exactly where it started.
  }
}
