import { useEffect } from "react";

import { useUiStore } from "../../stores/uiStore";

function ToastRow({ id, message }: { id: number; message: string }) {
  const dismiss = useUiStore((s) => s.dismissToast);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), 4000);
    return () => clearTimeout(timer);
  }, [id, dismiss]);

  return (
    <li
      className="rounded-control border border-line bg-surface px-4 py-2.5 text-sm text-text shadow-lg"
    >
      {message}
    </li>
  );
}

/** Toasts repeat the verb of the action that caused them (§8) — callers pass the wording. */
export function ToastViewport() {
  const toasts = useUiStore((s) => s.toasts);
  return (
    <ul
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 space-y-2"
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} id={t.id} message={t.message} />
      ))}
    </ul>
  );
}
