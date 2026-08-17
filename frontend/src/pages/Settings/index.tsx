import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useMe } from "../../features/auth/useAuth";
import { cx } from "../../lib/cx";
import { AboutSection } from "./About";
import { AppearanceSection } from "./Appearance";
import { InstanceSection } from "./Instance";
import { ProfileSection } from "./Profile";
import { SecuritySection } from "./Security";
import { UsersSection } from "./Users";
import { ConfirmDialog, DirtyContext, ICONS, Icon } from "./parts";

/**
 * Settings, as one page showing one section at a time.
 *
 * The old page stacked every group in its own bordered card, which read as an
 * admin console rather than as part of the app. Structure now comes from a quiet
 * section list and the page surface itself; the sections below own their own
 * saving, so nothing here knows what a preference is.
 */

export type SectionId = "profile" | "appearance" | "security" | "instance" | "users" | "about";

const SECTIONS: { id: SectionId; icon: string; adminOnly?: boolean }[] = [
  { id: "profile", icon: ICONS.profile },
  { id: "appearance", icon: ICONS.appearance },
  { id: "security", icon: ICONS.security },
  { id: "instance", icon: ICONS.instance, adminOnly: true },
  { id: "users", icon: ICONS.users, adminOnly: true },
  { id: "about", icon: ICONS.about },
];

function SectionNav({
  idPrefix,
  sections,
  active,
  labels,
  label,
  onSelect,
  orientation,
}: {
  idPrefix: string;
  sections: typeof SECTIONS;
  active: SectionId;
  labels: Record<SectionId, string>;
  /** Names the tablist itself — both copies of the nav describe the same thing. */
  label: string;
  onSelect: (id: SectionId) => void;
  orientation: "vertical" | "horizontal";
}) {
  const vertical = orientation === "vertical";
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Arrow keys move between tabs, which is what a `tablist` promises. Selection
  // follows focus, so the panel changes as you arrow through — there is nothing
  // to load, so there is nothing to make that expensive.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys = vertical ? ["ArrowDown", "ArrowUp"] : ["ArrowRight", "ArrowLeft"];
    const step = e.key === keys[0] ? 1 : e.key === keys[1] ? -1 : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const index = sections.findIndex((s) => s.id === active);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? sections.length - 1
          : (index + step + sections.length) % sections.length;
    const target = sections[next].id;
    refs.current[target]?.focus();
    onSelect(target);
  };

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx(
        vertical
          ? "flex flex-col gap-0.5"
          : "rail -mx-5 flex gap-1 overflow-x-auto px-5 pb-1 sm:-mx-11 sm:px-11",
      )}
    >
      {sections.map((section) => {
        const isActive = section.id === active;
        return (
          <button
            key={section.id}
            ref={(node) => {
              refs.current[section.id] = node;
            }}
            id={`${idPrefix}-tab-${section.id}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls="settings-panel"
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(section.id)}
            className={cx(
              "relative flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[13.5px] transition-colors",
              vertical ? "rounded-control px-3 py-2.5 text-left" : "rounded-pill px-3.5 py-2",
              // Colour is never the only signal: the active tab also carries a
              // gold rule — a bar down its left edge in the sidebar, an
              // underline in the phone rail — and steps up to medium weight.
              isActive
                ? "font-medium text-stamp-text"
                : "text-text-dim hover:bg-surface hover:text-text",
              isActive && vertical && "bg-surface",
              isActive &&
                vertical &&
                "before:absolute before:inset-y-1.5 before:-left-px before:w-[2px] before:rounded-pill before:bg-stamp",
              isActive && !vertical && "bg-surface",
              isActive &&
                !vertical &&
                "after:absolute after:inset-x-3.5 after:-bottom-px after:h-[2px] after:rounded-pill after:bg-stamp",
            )}
          >
            <Icon path={section.icon} className={isActive ? "text-stamp-text" : undefined} />
            {labels[section.id]}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const [dirty, setDirty] = useState(false);
  /** A section the user asked for while edits were pending. */
  const [pendingJump, setPendingJump] = useState<SectionId | null>(null);

  const isAdmin = me?.role === "admin";
  const sections = useMemo(() => SECTIONS.filter((s) => !s.adminOnly || isAdmin), [isAdmin]);

  const requested = params.get("s") as SectionId | null;
  const active: SectionId = sections.some((s) => s.id === requested) ? requested! : "profile";

  // The browser's own "leave site?" prompt is the only one available for a real
  // navigation away, and it only appears if something is actually unsaved.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const open = useCallback(
    (id: SectionId) => {
      setDirty(false);
      setParams(id === "profile" ? {} : { s: id }, { replace: true });
    },
    [setParams],
  );

  const select = (id: SectionId) => {
    if (id === active) return;
    if (dirty) setPendingJump(id);
    else open(id);
  };

  if (!me) return null;

  const labels: Record<SectionId, string> = {
    profile: t("settings.profile"),
    appearance: t("settings.appearance"),
    security: t("settings.security"),
    instance: t("settings.instance"),
    users: t("settings.users"),
    about: t("settings.about"),
  };

  return (
    <DirtyContext.Provider value={setDirty}>
      <div className="wrap py-8 sm:py-10">
        <header className="max-w-prose">
          <h1 className="font-display text-[26px] font-bold tracking-[-0.01em]">
            {t("settings.title")}
          </h1>
          <p className="mt-1.5 text-sm text-text-dim">{t("settings.subtitle")}</p>
        </header>

        {/* Phone: the section list becomes a rail under the title. */}
        <div className="mt-6 border-b border-line lg:hidden">
          <SectionNav
            idPrefix="rail"
            sections={sections}
            active={active}
            labels={labels}
            label={t("settings.sections")}
            onSelect={select}
            orientation="horizontal"
          />
        </div>

        <div className="mt-8 lg:mt-10 lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-14">
          <div className="hidden lg:block">
            <div className="sticky top-8">
              <SectionNav
                idPrefix="side"
                sections={sections}
                active={active}
                labels={labels}
                label={t("settings.sections")}
                onSelect={select}
                orientation="vertical"
              />
            </div>
          </div>

          {/* One column of content, capped so a text input never runs the full
              width of a 27" display. */}
          <div
            id="settings-panel"
            role="tabpanel"
            aria-label={labels[active]}
            tabIndex={-1}
            className="min-w-0 max-w-[660px] pb-10 outline-none"
          >
            {active === "profile" && <ProfileSection me={me} />}
            {active === "appearance" && <AppearanceSection me={me} />}
            {active === "security" && <SecuritySection />}
            {active === "instance" && isAdmin && <InstanceSection />}
            {active === "users" && isAdmin && <UsersSection me={me} />}
            {active === "about" && <AboutSection />}
          </div>
        </div>
      </div>

      {pendingJump && (
        <ConfirmDialog
          title={t("settings.discardTitle")}
          body={t("settings.discardBody")}
          confirmLabel={t("settings.discard")}
          onCancel={() => setPendingJump(null)}
          onConfirm={() => {
            open(pendingJump);
            setPendingJump(null);
          }}
        />
      )}
    </DirtyContext.Provider>
  );
}
