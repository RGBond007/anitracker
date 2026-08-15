import type { ButtonHTMLAttributes } from "react";

import { cx } from "../../lib/cx";

type Variant = "primary" | "ghost" | "stamp" | "quiet";

/**
 * `primary` is paper-on-ink rather than a coloured fill: against dark artwork a
 * light button is the strongest call to action, and it leaves the stamp gold to
 * mean "progress" everywhere else.
 */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-text text-bg font-semibold hover:opacity-90",
  ghost: "border border-hairline text-text hover:border-hairline-strong",
  stamp: "bg-stamp text-ink-950 font-semibold hover:brightness-110",
  quiet: "text-text-dim hover:text-text",
};

export function Button({
  variant = "ghost",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-control px-[18px] py-3 text-sm",
        "font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}

/** Pill filter. Selected reads as ink-on-paper, matching the primary button. */
export function Chip({
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      aria-pressed={active}
      className={cx(
        "rounded-pill border px-[15px] py-[7px] text-[12.5px] transition",
        active
          ? "border-text bg-text font-semibold text-bg"
          : "border-line bg-surface text-text-dim hover:border-control-line hover:text-text",
        className,
      )}
      {...rest}
    />
  );
}

/** Round icon button — used for the collapsed search affordance in the nav. */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "flex h-[34px] w-[34px] items-center justify-center rounded-full text-text-dim",
        "transition hover:bg-surface hover:text-text",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
