import { forwardRef, useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

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
  stamp: "bg-stamp text-stamp-ink font-semibold hover:brightness-110",
  quiet: "text-text-dim hover:text-text",
};

/**
 * Forwards its ref: a dialog has to be able to put the focus on a *particular*
 * button when it opens, and the destructive one lands it on Cancel.
 *
 * `pending` is the whole in-flight state in one prop. Twenty buttons in the app
 * were written as `disabled={mutation.isPending}` and nothing else, which says
 * "you cannot press this" without ever saying why — and to a screen reader says
 * even less, because a disabled button is simply skipped. Passing `pending`
 * disables it, marks it `aria-busy`, and swaps the label for one that names what
 * is happening, so the button's accessible name carries the state that a spinner
 * would only carry visually.
 */
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    /** In flight. Disables the button and announces itself through the label. */
    pending?: boolean;
    /** What to say while it is in flight — "Saving…" rather than "Save". */
    pendingLabel?: ReactNode;
  }
>(function Button(
  { variant = "ghost", className, pending, pendingLabel, disabled, children, onClick, ...rest },
  ref,
) {
  /**
   * `disabled={mutation.isPending}` looks like it stops a second press and does
   * not: the flag only turns true once React has re-rendered, and three clicks
   * dispatched in one tick all run before that. Measured against a slow write,
   * that sent the same PUT three times.
   *
   * So the latch is a ref, which is already true by the time the second click
   * asks. It is armed only for a button that was given a `pending` prop — every
   * other button in the app, a tab or a filter chip, must stay repeatable.
   */
  const managed = pending !== undefined;
  const firedRef = useRef(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  // Released when the request finishes, however it finishes: a failed save has
  // to be repeatable, and a button that stays dead after an error is worse than
  // one that could be pressed twice.
  useEffect(() => {
    if (!pending) firedRef.current = false;
  }, [pending]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (managed) {
      if (firedRef.current) return;
      firedRef.current = true;
      // A press that started nothing — a guard clause in the handler, a form
      // that failed validation — never turns `pending` true, and would leave the
      // latch closed forever. Reopened on the next macrotask unless something
      // really did begin.
      window.setTimeout(() => {
        if (!pendingRef.current) firedRef.current = false;
      }, 0);
    }
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      // `aria-busy` is what tells assistive technology this control is working
      // rather than broken.
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-control px-[18px] py-3 text-sm",
        "font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </button>
  );
});

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
