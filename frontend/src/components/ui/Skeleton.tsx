import { cx } from "../../lib/cx";

/** Flat blocks on the panel surface. No shimmer sweep — §6 rules gimmicks out. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("rounded-poster bg-surface", className)} />;
}

/** Mirrors the real poster geometry exactly so the swap does not jump. */
export function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-5 gap-y-7 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-2/3 w-full" />
          <Skeleton className="mt-2.5 h-3 w-4/5 rounded-sm" />
          <Skeleton className="mt-1.5 h-3 w-2/5 rounded-sm" />
        </div>
      ))}
    </div>
  );
}
