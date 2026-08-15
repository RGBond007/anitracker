import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../../lib/cx";

/**
 * The base surface for forms and settings blocks. Posters do not use it — artwork
 * carries its own frame.
 */
export function Panel({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div className={cx("rounded-control border border-line bg-surface", className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-4">
      <h2 className="font-display text-[15px] font-bold tracking-[-0.01em]">{children}</h2>
      {right}
    </div>
  );
}
