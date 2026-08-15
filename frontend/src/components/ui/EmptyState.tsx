import type { ReactNode } from "react";

/** §8: empty states are an invitation, not an apology. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-control border border-line px-6 py-16 text-center">
      <p className="max-w-sm text-sm text-text-dim">{children}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-control border border-stamp/50 px-6 py-12 text-center">
      <p className="max-w-md text-sm text-text">{children}</p>
      {action}
    </div>
  );
}
