import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";

/** Escape closes, focus lands inside, background click closes. Nothing fancier. */
export function Modal({
  title,
  onClose,
  initialFocusRef,
  children,
}: {
  title: string;
  onClose: () => void;
  /**
   * What to focus instead of the panel. A destructive dialog points this at its
   * Cancel button, so the first thing under a pressed Return is the way out
   * rather than the deletion — the panel itself is the right default everywhere
   * the dialog is a form and the answer is not already dangerous.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    (initialFocusRef?.current ?? panelRef.current)?.focus();
    return () => window.removeEventListener("keydown", onKey);
    // Deliberately not keyed on the ref: it is stable, and re-running would
    // steal focus back from whatever the user tabbed to after the dialog opened.
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-control border border-line bg-surface"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="font-display text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
          {/* A drawn cross, not the "✕" character: the glyph's weight and size
              come from whatever font the OS falls back to. */}
          <button onClick={onClose} aria-label={t("common.close")} className="text-text-dim hover:text-text">
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
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
