import { useTranslation } from "react-i18next";

import type { Reaction } from "../../lib/api-client";
import { useMe } from "../../features/auth/useAuth";
import { useReact, useReactions } from "../../features/social/useMoments";
import { cx } from "../../lib/cx";

/**
 * The five things you can say about a friend finishing something.
 *
 * A closed set, and that is the design rather than a limitation. An open comment
 * box on someone else's finished show is a moderation surface, a spoiler surface
 * and an argument surface at once; five fixed words are none of those and still
 * carry the thing worth carrying, which is "I saw that".
 *
 * There is no count anywhere and no ranking. The moment a reaction becomes a
 * number people accumulate, it stops being a moment.
 */
const KINDS: { kind: Reaction; glyph: string }[] = [
  { kind: "clapped", glyph: "👏" },
  { kind: "same", glyph: "🙌" },
  { kind: "queued", glyph: "📌" },
  { kind: "envious", glyph: "🥲" },
  { kind: "crying", glyph: "😭" },
];

export function Reactions({ entryId }: { entryId: number }) {
  const { t } = useTranslation();
  const { data } = useReactions(entryId);
  const { data: me } = useMe();
  const react = useReact();

  const mine = data?.mine ?? null;
  // Other people only. Your own reaction is already shown by the pill being lit,
  // and reading your own name back at you is noise.
  const others = (data?.reactions ?? []).filter((row) => row.user.username !== me?.username);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-[3px]">
      {KINDS.map(({ kind, glyph }) => {
        const picked = mine === kind;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={picked}
            aria-label={t(`moments.reaction.${kind}`)}
            title={t(`moments.reaction.${kind}`)}
            disabled={react.isPending}
            // Tapping the one you already picked takes it back; tapping another
            // replaces it. One person, one reaction.
            onClick={() => react.mutate({ entryId, kind: picked ? null : kind })}
            className={cx(
              // Sized so all five fit one line of a 168px rail cell: any wider and
              // the row wraps, which turns a quiet control into a block of chrome.
              "rounded-pill border px-1.5 py-[3px] text-[12px] leading-none transition-colors",
              picked
                ? "border-stamp bg-stamp/15 text-text"
                : "border-line text-text-dim hover:border-control-line",
            )}
          >
            <span aria-hidden>{glyph}</span>
          </button>
        );
      })}

      {/* Who reacted, named rather than counted. */}
      {others.length > 0 && (
        <p className="mt-0.5 w-full truncate text-[11px] text-text-faint">
          {others
            .slice(0, 3)
            .map((row) => row.user.username)
            .join(", ")}
        </p>
      )}
    </div>
  );
}
