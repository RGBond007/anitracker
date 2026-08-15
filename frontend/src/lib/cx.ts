import { extendTailwindMerge } from "tailwind-merge";

/**
 * Class joiner that resolves Tailwind conflicts, so the *last* class wins.
 *
 * This used to be a plain `parts.join(" ")`, which left every collision between a
 * component's hardcoded base class and a caller's `className` to be settled by
 * stylesheet order. That is invisible at the call site and silently wrong: a
 * `<CoverImage className="absolute inset-0">` lost to the base `relative` and
 * collapsed every poster to 0px, and a skeleton asking for `rounded-none` was
 * overruled by the base `rounded-poster`.
 *
 * `index.css` wipes Tailwind's default palette and defines its own scales, so the
 * custom theme keys are registered here — otherwise `rounded-poster` reads as an
 * unknown class and does not merge with `rounded-none`.
 */
export const cx = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "ink-950",
        "ink-900",
        "ink-800",
        "gutter",
        "paper",
        "paper-dim",
        "paper-faint",
        "stamp",
        "stamp-text",
        "bg",
        "surface",
        "line",
        "text",
        "text-dim",
        "text-faint",
        "control-line",
        "hairline",
        "hairline-strong",
      ],
      radius: ["poster", "control", "pill"],
      font: ["display", "sans", "mono"],
    },
  },
});
