import { useState } from "react";

import { cx } from "../../lib/cx";

/** Anyone who can be drawn as a face: the viewer, a friend, a row in admin. */
export interface AvatarSubject {
  username: string;
  avatar_url?: string | null;
}

/**
 * A person, at whatever size the place they appear calls for.
 *
 * One component for every avatar in the app, because the two states have to agree:
 * an account with an uploaded picture and an account without one must occupy the
 * same circle, or a list of people ripples as it loads. The initials disc is not a
 * placeholder waiting to be replaced -- it is what most accounts on a small
 * instance will always show, so it is the same gold disc the navigation has always
 * drawn, only tinted per person so a row of friends is not five identical coins.
 *
 * A picture that fails to load falls back to the initials rather than leaving the
 * browser's broken-image glyph in a circle.
 */
export function Avatar({
  user,
  size = 32,
  className,
  decorative = false,
}: {
  user: AvatarSubject;
  size?: number;
  className?: string;
  /** True where the username is already written next to it, as it usually is. */
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const url = user.avatar_url;

  const shared = cx(
    "shrink-0 rounded-full border border-line bg-surface object-cover",
    className,
  );
  const box = { width: size, height: size };

  if (url && !failed) {
    return (
      <img
        src={url}
        // Empty alt where the name is right there: a screen reader announcing
        // "taro, taro" is worse than one that just reads the name.
        alt={decorative ? "" : user.username}
        aria-hidden={decorative || undefined}
        width={size}
        height={size}
        // Avatars sit in rails and long lists, most of them below the fold.
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={shared}
        style={box}
      />
    );
  }

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : user.username}
      aria-hidden={decorative || undefined}
      className={cx(
        shared,
        "font-mono inline-flex items-center justify-center font-medium text-ink-950",
      )}
      style={{
        ...box,
        fontSize: Math.max(9, Math.round(size * 0.34)),
        background: `linear-gradient(135deg, var(--stamp), ${shade(user.username)})`,
      }}
    >
      {initials(user.username)}
    </span>
  );
}

/** Two letters, and never an empty disc for a name we were handed blank. */
function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/[\s._-]+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * The far end of the disc's gradient, chosen from the name.
 *
 * Deterministic, so a person is the same colour on every page and across
 * reloads, and confined to the darker half of the existing gold rather than
 * reaching for hues the palette does not have. The initials stay near-black on
 * every value in the range, so contrast does not depend on the name.
 */
function shade(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  // 30-58 degrees keeps it amber-to-brass; lightness stays low so the ink reads.
  return `hsl(${30 + (hash % 28)} ${55 + (hash % 20)}% ${22 + (hash % 12)}%)`;
}
