import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/** Escape closes, focus lands inside, background click closes. Nothing fancier. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
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
          <button onClick={onClose} aria-label="Close" className="text-text-dim hover:text-text">
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
