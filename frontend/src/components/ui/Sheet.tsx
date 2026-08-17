import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * The editing surface for a row of the page: a drawer down the right edge on a
 * desktop, a sheet up from the bottom of a phone.
 *
 * It is one component rather than two because it is one idea — "the rest of the
 * fields, next to what they belong to" — and because the difference is a media
 * query, not behaviour. Escape closes it, focus is trapped inside while it is
 * open and handed back to whatever opened it on the way out, and the page behind
 * is frozen so a phone does not scroll the article under the sheet.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Read through a ref so the effect below runs once, on open. Depending on
  // `onClose` directly would re-run it — and so re-take focus — on every render
  // of whatever is inside the sheet.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const focusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    const first = focusable()[0];
    if (first) first.focus();
    else panel?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
      {/* The scrim is the click target for "close": it is the part of the screen
          that is not the sheet, at both sizes. */}
      <div aria-hidden className="absolute inset-0 bg-ink-950/70" onMouseDown={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={
          // Bottom sheet: capped short of the top so the page stays visible behind
          // it, and rounded only where it leaves the edge of the screen.
          "relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-control " +
          "border-t border-line bg-surface " +
          // Drawer: full height against the right edge, so the corner radii go.
          "sm:max-h-none sm:w-[420px] sm:rounded-none sm:border-l sm:border-t-0"
        }
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="font-display text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-control text-text-dim transition-colors hover:text-text pointer-coarse:min-w-[44px]"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* The fields scroll, the header does not: on a phone the sheet is short
            and the title is what says where you are. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
