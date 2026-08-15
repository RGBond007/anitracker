import { useState } from "react";

import { cx } from "../../lib/cx";
import type { Media, TitleLanguage } from "../../lib/api-client";
import { coverAlt } from "../../lib/titles";

/**
 * Covers arrive from three CDNs at three speeds, so the box holds its own size and
 * fills with `ink-800` until the art lands.
 *
 * The root is `relative` so the <img> has something to anchor to. A caller may
 * override that (`cx` resolves the conflict in the caller's favour), but only with
 * another positioned value — `static` would let the <img> escape to the page.
 *
 * It deliberately does *not* use the provider's `coverImage.color`: those are
 * vibrant per-title accents, and painting one behind every card turned the grid
 * into a patchwork of saturated colours that no token in the palette accounts for.
 */
export function CoverImage({
  media,
  lang,
  className,
}: {
  media: Media;
  lang: TitleLanguage;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cx("relative overflow-hidden bg-ink-800", className)}>
      {media.cover_url && (
        <img
          src={media.cover_url}
          alt={coverAlt(media, lang)}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={cx(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
