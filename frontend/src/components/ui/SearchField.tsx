import { useRef } from "react";

import { cx } from "../../lib/cx";
import { Icon, ICONS } from "./Icon";

/**
 * The one field a search page is built around.
 *
 * A form rather than a bare input, so Enter submits: the page debounces typing to
 * spare the provider's rate limit, and someone who has finished typing should not
 * have to wait out a timer they cannot see. The leading mark doubles as the
 * progress indicator — the place you are already looking is where "still working"
 * belongs — and Escape clears, which is what every other search box on the machine
 * does.
 */
export function SearchField({
  value,
  onChange,
  onSubmit,
  busy = false,
  label,
  clearLabel,
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Enter, or the search key on a phone: apply what has been typed now. */
  onSubmit: () => void;
  busy?: boolean;
  label: string;
  clearLabel: string;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <form
      role="search"
      aria-busy={busy}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="relative"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center text-text-dim"
      >
        {busy ? (
          <span className="block h-[15px] w-[15px] animate-spin rounded-full border-[1.5px] border-line border-t-stamp" />
        ) : (
          <Icon path={ICONS.search} size={16} />
        )}
      </span>

      <input
        ref={inputRef}
        // `type="search"` for the phone keyboard's search key and the OS's own
        // handling; WebKit's built-in clear cross is suppressed because there is a
        // drawn one below that matches everything else on the page.
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            clear();
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className={cx(
          "w-full rounded-control border border-control-line bg-surface py-3 pl-11 pr-11",
          "text-sm pointer-coarse:text-base text-text outline-none transition-colors",
          "placeholder:text-text-faint hover:border-text-dim focus:border-stamp",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label={clearLabel}
          className={cx(
            "absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center",
            "rounded-control text-text-dim transition-colors hover:text-text",
            "pointer-coarse:min-w-[44px]",
          )}
        >
          <Icon path={ICONS.close} size={15} />
        </button>
      )}
    </form>
  );
}
