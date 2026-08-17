import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import { cx } from "../../lib/cx";
import { Icon, ICONS } from "./Icon";

export type MenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  /** Draws a tick and marks the item as the current choice for a screen reader. */
  selected?: boolean;
  /** Removals and the like: gold text, and always last in the list. */
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * A short list of actions hung off a button.
 *
 * Small enough to stay in the page rather than becoming a dialog: it is anchored
 * to its trigger, closes on Escape, on a click outside and on Tab, and moves
 * focus — real focus, not `aria-activedescendant` — with the arrow keys, so the
 * focus ring the rest of the app draws is the one that shows here too.
 */
export function Menu({
  items,
  label,
  triggerLabel,
  align = "start",
  triggerClassName,
  children,
}: {
  items: MenuItem[];
  /** Names the list itself — "Change status", not the value it currently holds. */
  label: string;
  /**
   * Names the button, for a trigger whose content is an icon. Left off where the
   * trigger already says something — a pill reading "Watching" is its own label,
   * and replacing that with "Change status" would hide the value from a screen
   * reader that the sighted user can see.
   */
  triggerLabel?: string;
  align?: "start" | "end";
  triggerClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const openAt = (index: number) => {
    setActive(index);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    itemRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    const last = items.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i >= last ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? last : i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(last);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
        onClick={() => (open ? close(false) : openAt(Math.max(0, items.findIndex((i) => i.selected))))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            openAt(0);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            openAt(items.length - 1);
          }
        }}
      >
        {children}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          aria-orientation="vertical"
          onKeyDown={onMenuKeyDown}
          className={cx(
            "absolute top-[calc(100%+6px)] z-40 min-w-[176px] rounded-control border border-line",
            "bg-surface py-1",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              aria-current={item.selected || undefined}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
              className={cx(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-40",
                item.destructive
                  ? "text-text-dim hover:bg-bg hover:text-stamp-text"
                  : "text-text-dim hover:bg-bg hover:text-text",
                item.selected && "text-text",
              )}
            >
              <span className="w-4 shrink-0 text-stamp">
                {item.selected && <Icon path={ICONS.check} size={14} strokeWidth={2} />}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
