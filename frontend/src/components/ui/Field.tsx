import { Children, cloneElement, isValidElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";

/**
 * Label, control, and one line of hint or error.
 *
 * The label is wired to the control automatically: `Field` mints an id and hands
 * it to its child, so clicking the label focuses the input and a screen reader
 * announces the pair. Callers used to have to pass `htmlFor` by hand and none of
 * them did, which left every label in the app decorative. `aria-labelledby` goes
 * along with it for the composite controls (`Segmented` renders a radiogroup,
 * which `htmlFor` cannot point at).
 */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Escape hatch: skips the automatic wiring and targets this id instead. */
  htmlFor?: string;
  children: ReactNode;
}) {
  const generated = useId();
  const controlId = htmlFor ?? `${generated}-control`;
  const labelId = `${generated}-label`;
  const messageId = `${generated}-message`;

  const only = Children.only(children);
  const control =
    !htmlFor && isValidElement(only)
      ? cloneElement(only as ReactElement<Record<string, unknown>>, {
          id: (only.props as { id?: string }).id ?? controlId,
          "aria-labelledby": labelId,
          "aria-describedby": hint || error ? messageId : undefined,
          "aria-invalid": error ? true : undefined,
        })
      : only;

  return (
    <div className="space-y-1.5">
      <label id={labelId} htmlFor={controlId} className="block text-xs font-medium text-text-dim">
        {label}
      </label>
      {control}
      {/* Errors say what happened, never "Oops" (§8). */}
      {error ? (
        <p id={messageId} className="text-xs text-stamp-text">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
