import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cx } from "../../lib/cx";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";

/**
 * The pieces the settings sections are built from.
 *
 * Settings used to be a stack of `Panel`s, which made every group look like a
 * separate object on the page. Here structure comes from headings, spacing and
 * hairlines instead, so the whole page reads as one surface.
 */

/**
 * A section with unsaved edits reports it here, and the shell warns before those
 * edits would be dropped — by switching section, or by leaving the app.
 */
export const DirtyContext = createContext<(dirty: boolean) => void>(() => {});

export function useUnsavedGuard(dirty: boolean) {
  const report = useContext(DirtyContext);
  useEffect(() => {
    report(dirty);
    return () => report(false);
  }, [dirty, report]);
}

/** Stroke icons, drawn in the same 24px grid as the nav so weights match. */
export const ICONS = {
  profile: "M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  appearance:
    "M12 3a9 9 0 1 0 0 18h1.6a2.4 2.4 0 0 0 0-4.8H13a2 2 0 0 1 0-4h3.9A4.1 4.1 0 0 0 21 8.1 5.1 5.1 0 0 0 15.9 3ZM7.5 12h.01M9 8.2h.01M14.4 7.4h.01",
  security: "M6 11h12v8.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5zM8.5 11V7.5a3.5 3.5 0 1 1 7 0V11",
  instance: "M4 4.5h16v5H4zM4 14.5h16v5H4zM7.4 7h.01M7.4 17h.01",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87",
  about: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11.5V16M12 8h.01",
  more: "M12 5.5h.01M12 12h.01M12 18.5h.01",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35",
  check: "m4.5 12.5 5 5 10-11",
  plus: "M12 5v14M5 12h14",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
} as const;

export function Icon({
  path,
  size = 16,
  className,
}: {
  path: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

/** API errors arrive as `Error`; `String(err)` would print the "Error: " prefix. */
export function errorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  return error instanceof Error ? error.message : String(error);
}

/**
 * A save confirmation that lives next to the control instead of over the page.
 * Two seconds is long enough to be read and short enough not to become chrome.
 */
export function useSavedFlag(ms = 2000) {
  const [saved, setSaved] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback(
    (key = "default") => {
      clearTimeout(timer.current);
      setSaved(key);
      timer.current = setTimeout(() => setSaved(null), ms);
    },
    [ms],
  );

  return [saved, flash] as const;
}

/** The "Saved" tick. `aria-live` so it is announced, not only seen. */
export function SavedNote({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      role="status"
      className={cx("inline-flex items-center gap-1.5 text-xs text-text-dim", className)}
    >
      <Icon path={ICONS.check} size={13} className="text-stamp-text" />
      {t("settings.saved")}
    </span>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h2 className="font-display text-[19px] font-bold tracking-[-0.01em]">{title}</h2>
        {description && <p className="mt-1.5 max-w-prose text-[13px] text-text-dim">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Hairline-separated stack. The rows carry the structure; no box around them. */
export function SettingRows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line border-y border-line">{children}</div>;
}

/**
 * Name and explanation on the left, control on the right — until the column is
 * too narrow to hold both, where the control drops underneath its label rather
 * than being squeezed.
 *
 * The label is wired to the control the same way `Field` does it, by minting an
 * id and handing it down: `htmlFor` cannot point at a `Segmented`, which renders
 * a radiogroup rather than a single input.
 */
export function SettingRow({
  label,
  description,
  children,
  status,
  controlClassName,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  /** Rendered under the control — the per-row "Saved" note. */
  status?: ReactNode;
  controlClassName?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const descId = `${id}-desc`;

  const only = Children.only(children);
  const control = isValidElement(only)
    ? cloneElement(only as ReactElement<Record<string, unknown>>, {
        "aria-labelledby": labelId,
        "aria-describedby": description ? descId : undefined,
      })
    : only;

  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0 sm:pt-1.5">
        <p id={labelId} className="text-sm font-medium text-text">
          {label}
        </p>
        {description && (
          <p id={descId} className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-text-dim">
            {description}
          </p>
        )}
      </div>
      <div className={cx("shrink-0 sm:w-[260px]", controlClassName)}>
        {control}
        {status && <div className="mt-2 flex justify-start sm:justify-end">{status}</div>}
      </div>
    </div>
  );
}

/**
 * One save action per section, on a hairline of its own so it is clearly the end
 * of the section rather than another row.
 */
export function SaveRow({
  label,
  dirty,
  pending,
  saved,
  error,
  onSave,
}: {
  label: string;
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  error?: string;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-7 space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        {/* Ghost until there is something to save: a filled button that cannot
            be pressed reads as a broken button, not a waiting one. */}
        <Button
          type="button"
          variant={dirty ? "primary" : "ghost"}
          disabled={!dirty || pending}
          onClick={onSave}
        >
          {pending ? t("settings.saving") : label}
        </Button>
        {saved && !dirty && <SavedNote />}
        {dirty && !pending && <span className="text-xs text-text-faint">{t("settings.unsaved")}</span>}
      </div>
      {error && (
        <p role="alert" className="text-sm text-stamp-text">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Destructive confirmation. A real dialog rather than `window.confirm`, so the
 * wording, the focus trap and the button labels are ours — "Delete Ada", not
 * "OK".
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm leading-relaxed text-text-dim">{body}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={onConfirm}
          className="border-stamp-text/60 text-stamp-text hover:border-stamp-text"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
