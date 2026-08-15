import { forwardRef } from "react";
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cx } from "../../lib/cx";

// `pointer-coarse:text-base` is the iOS zoom fix and has to live here as a
// utility: the same rule in `@layer base` loses to `text-sm` every time.
const BASE =
  "w-full rounded-control border border-control-line bg-surface px-3 py-2.5 " +
  "text-sm pointer-coarse:text-base text-text " +
  "outline-none transition-colors placeholder:text-text-faint hover:border-text-dim " +
  "focus:border-stamp disabled:cursor-not-allowed disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(BASE, className)} {...rest} />;
  },
);

export const NumberInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function NumberInput({ className, ...rest }, ref) {
    // Counts and scores are data: they belong in the mono role.
    return <input ref={ref} type="number" className={cx(BASE, "tabular", className)} {...rest} />;
  },
);

/**
 * `appearance-none` is what makes the control match the rest of the palette, but
 * it also removes the platform's disclosure arrow — which left every dropdown
 * looking exactly like a text input, with nothing to say it opens. The chevron is
 * drawn back in, and `option` is given explicit colours because a popup inheriting
 * the page's dark ground is otherwise dark-on-dark on Windows and Linux.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    // `className` sizes and places the whole control, so it goes on the wrapper —
    // on the inner <select> a caller's `w-auto` would be overridden by the box
    // around it, which is always as wide as the field.
    return (
      <div className={cx("relative", className)}>
        <select
          ref={ref}
          className={cx(BASE, "cursor-pointer appearance-none pr-9")}
          {...rest}
        />
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(BASE, "resize-y", className)} {...rest} />;
  },
);

/**
 * A two- or three-way choice, shown in full rather than hidden behind a dropdown.
 *
 * Built on real radio inputs, so arrow keys move between options and the group
 * announces itself as a radiogroup. The inputs are visually hidden rather than
 * `display:none`, which would take them out of the focus order entirely.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  name,
  className,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  /** Must be unique on the page — it groups the radios. */
  name: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cx(
        "inline-flex w-full rounded-control border border-control-line bg-surface p-0.5",
        className,
      )}
      {...rest}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <label
            key={option.value}
            className={cx(
              // `min-w-0` + `truncate`: without them a long label overflows its
              // segment instead of shrinking, and a two-word one wraps and makes
              // the whole control twice as tall as its neighbours.
              // `min-h` on a coarse pointer: the label is the tap target, and a
              // radio's label is not covered by the button rule in index.css.
              "relative min-w-0 flex-1 cursor-pointer truncate rounded-[6px] px-2 py-2",
              "pointer-coarse:min-h-[44px] pointer-coarse:leading-[28px]",
              "text-center text-[13px] transition-colors select-none",
              active ? "bg-text font-semibold text-bg" : "text-text-dim hover:text-text",
            )}
            title={option.label}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
