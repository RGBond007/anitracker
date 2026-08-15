import type { Media, TitleLanguage } from "./api-client";

/**
 * Per-user title language with a deterministic fallback chain — a title missing an
 * English name must never render as "Untitled" when a romaji name exists.
 */
export function displayTitle(media: Media, lang: TitleLanguage): string {
  const chains: Record<TitleLanguage, (string | null | undefined)[]> = {
    romaji: [media.title_romaji, media.title_english, media.title_native],
    english: [media.title_english, media.title_romaji, media.title_native],
    native: [media.title_native, media.title_romaji, media.title_english],
  };
  return chains[lang].find(Boolean) ?? "Untitled";
}

/** Alt text is built from the real title (§7) — never "image", never blank. */
export function coverAlt(media: Media, lang: TitleLanguage): string {
  return `Cover art for ${displayTitle(media, lang)}`;
}

export function progressLabel(progress: number, total?: number | null): string {
  return total ? `${progress}/${total}` : `${progress}`;
}
