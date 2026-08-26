import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMe } from "../../features/auth/useAuth";
import { cx } from "../../lib/cx";

/**
 * Content held back until the reader asks for it.
 *
 * One primitive for every place something might give a story away, so revealing
 * always works the same way and always takes a deliberate act. The text is in the
 * DOM but blurred and inert -- not fetched-on-demand, which would be a different
 * and much larger promise. This is protection from *accidentally reading*, not
 * from a determined reader with dev tools, and it says so rather than implying
 * a guarantee it cannot keep.
 *
 * Respects the account's `spoiler_protection` preference: with it off, children
 * render plainly and this component is a passthrough.
 */
export function Spoiler({
  reason,
  children,
  className,
  compact = false,
}: {
  /** Why this is covered — shown on the reveal control so the choice is informed. */
  reason: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Drop the reason from the control. For lists where the same rule covers every
   * row and repeating it once per line is noise — the caller states it once above
   * instead. The control still says what it does; only the redundancy goes.
   */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const [shown, setShown] = useState(false);

  if (me && !me.spoiler_protection) return <>{children}</>;
  if (shown) return <>{children}</>;

  return (
    <span className={cx("block", className)}>
      <span
        aria-hidden
        className="pointer-events-none block select-none blur-[5px] saturate-50"
      >
        {children}
      </span>
      <button
        type="button"
        // The reason is on the control even when compact, for anyone who reaches
        // it by keyboard or screen reader and has not read the line above.
        aria-label={`${t("spoiler.reveal")} — ${reason}`}
        onClick={() => setShown(true)}
        className={cx(
          "inline-flex items-center gap-1.5 rounded-pill border border-line",
          "text-text-dim transition-colors hover:border-control-line hover:text-text",
          compact ? "mt-0.5 px-2 py-[2px] text-[11px]" : "mt-1 px-2.5 py-1 text-[11.5px]",
        )}
      >
        {t("spoiler.reveal")}
        {!compact && <span className="text-text-faint">· {reason}</span>}
      </button>
    </span>
  );
}
