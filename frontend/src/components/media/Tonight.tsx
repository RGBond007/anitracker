import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Entry, MediaType, TitleLanguage } from "../../lib/api-client";
import type { FriendSignal, Reason, TonightOptions, TonightPick } from "../../features/discovery/tonight";
import { genresAvailable, tonightQueue } from "../../features/discovery/tonight";
import { useFeed, useFriendsWatching } from "../../features/social/useSocial";
import { useRecommendInbox } from "../../features/recommend/useRecommend";
import { CoverImage } from "./CoverImage";
import { mediaHref } from "./Poster";
import { displayTitle } from "../../lib/titles";
import { Button, Chip } from "../ui/Button";
import { Icon, ICONS } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { Segmented } from "../ui/Input";
import { cx } from "../../lib/cx";
import { Link } from "react-router-dom";

/**
 * "What should I watch tonight?" — a queue of three from your own library.
 *
 * A question-and-answer, not a feed: you say how much evening you have and what
 * kind of thing you are after, and the answer is three titles with the argument
 * for each spelled out. Small on purpose — three choices can be read; ten is a
 * list to scroll past, which is the problem this exists to solve.
 */
export function Tonight({ entries, lang }: { entries: Entry[]; lang: TitleLanguage }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <>
      <div className="mb-8 sm:mb-14">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cx(
            "flex w-full items-center justify-between gap-3 rounded-control border border-line",
            "bg-surface px-4 py-3 text-left transition-colors hover:border-control-line",
          )}
        >
          <span className="min-w-0">
            <span className="block font-display text-[14px] font-semibold">
              {t("tonight.ask")}
            </span>
            <span className="block text-[12px] text-text-faint">{t("tonight.hint")}</span>
          </span>
          <Icon path={ICONS.chevronDown} size={16} className="shrink-0 -rotate-90 text-text-dim" />
        </button>
      </div>

      {open && <TonightSheet entries={entries} lang={lang} onClose={() => setOpen(false)} />}
    </>
  );
}

function TonightSheet({
  entries,
  lang,
  onClose,
}: {
  entries: Entry[];
  lang: TitleLanguage;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const feed = useFeed();
  const watching = useFriendsWatching();
  const inbox = useRecommendInbox();

  const [minutes, setMinutes] = useState<"25" | "50" | "90">("50");
  const [mode, setMode] = useState<"continue" | "fresh">("continue");
  const [type, setType] = useState<MediaType>("anime");
  const [genre, setGenre] = useState<string | null>(null);
  const [company, setCompany] = useState<"alone" | "friends">("alone");
  const [built, setBuilt] = useState(false);

  /**
   * What friends have to do with each title, keyed by provider pair. Read from
   * queries the dashboard already runs — no new endpoint, and each reason names
   * a real person doing a real thing.
   */
  const friendSignals = useMemo(() => {
    const map = new Map<string, FriendSignal[]>();
    const add = (provider: string, id: string, signal: FriendSignal) => {
      const key = `${provider}:${id}`;
      map.set(key, [...(map.get(key) ?? []), signal]);
    };
    for (const item of watching.data ?? []) {
      add(item.entry.media.provider, item.entry.media.provider_id, {
        name: item.user.username,
        kind: "watching",
      });
    }
    for (const row of inbox.data ?? []) {
      if (row.state !== "dismissed") add(row.provider, row.provider_id, { name: row.sender.username, kind: "sent" });
    }
    for (const item of feed.data ?? []) {
      if (item.entry.status === "completed" && (item.entry.score ?? 0) >= 9) {
        add(item.entry.media.provider, item.entry.media.provider_id, {
          name: item.user.username,
          kind: "loved",
        });
      }
    }
    return map;
  }, [feed.data, watching.data, inbox.data]);

  const options: TonightOptions = {
    minutes: Number(minutes) as TonightOptions["minutes"],
    fresh: mode === "fresh",
    type,
    genre,
    withFriends: company === "friends",
  };

  const ranked = useMemo(
    () => (built ? tonightQueue(entries, options, friendSignals) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [built, entries, minutes, mode, type, genre, company, friendSignals],
  );

  const genres = genresAvailable(entries, type);

  return (
    <Modal title={t("tonight.title")} onClose={onClose}>
      {!built ? (
        <div className="space-y-4">
          <Control label={t("tonight.time")}>
            <Segmented
              name="tonight-time"
              value={minutes}
              onChange={setMinutes}
              options={[
                { value: "25", label: t("tonight.minutes", { count: 25 }) },
                { value: "50", label: t("tonight.minutes", { count: 50 }) },
                { value: "90", label: t("tonight.minutes", { count: 90 }) },
              ]}
            />
          </Control>

          <Control label={t("tonight.what")}>
            <Segmented
              name="tonight-mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "continue", label: t("tonight.continue") },
                { value: "fresh", label: t("tonight.fresh") },
              ]}
            />
          </Control>

          <Control label={t("tonight.medium")}>
            <Segmented
              name="tonight-type"
              value={type}
              onChange={(next) => {
                setType(next);
                setGenre(null); // the genres on offer change with the medium
              }}
              options={[
                { value: "anime", label: t("tonight.anime") },
                { value: "manga", label: t("tonight.manga") },
              ]}
            />
          </Control>

          {genres.length > 0 && (
            <Control label={t("tonight.mood")}>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={genre === null} onClick={() => setGenre(null)}>
                  {t("tonight.anyGenre")}
                </Chip>
                {genres.map((name) => (
                  <Chip key={name} active={genre === name} onClick={() => setGenre(name)}>
                    {name}
                  </Chip>
                ))}
              </div>
            </Control>
          )}

          <Control label={t("tonight.company")}>
            <Segmented
              name="tonight-company"
              value={company}
              onChange={setCompany}
              options={[
                { value: "alone", label: t("tonight.alone") },
                { value: "friends", label: t("tonight.withFriends") },
              ]}
            />
          </Control>

          <div className="flex justify-end pt-1">
            <Button variant="stamp" onClick={() => setBuilt(true)}>
              {t("tonight.build")}
            </Button>
          </div>
        </div>
      ) : (
        <Queue
          ranked={ranked}
          lang={lang}
          onBack={() => setBuilt(false)}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * The three, with the levers the brief asks for: replace pulls the next-best
 * candidate off the same ranking, dismiss just removes, and reorder is two
 * arrows. All of it is session state — tonight's queue is tonight's.
 */
function Queue({
  ranked,
  lang,
  onBack,
  onClose,
}: {
  ranked: TonightPick[];
  lang: TitleLanguage;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [slots, setSlots] = useState<number[]>(() => ranked.slice(0, 3).map((_, i) => i));

  const nextUnused = () => {
    const used = new Set(slots);
    for (let i = 0; i < ranked.length; i += 1) if (!used.has(i)) return i;
    return null;
  };

  const replace = (position: number) => {
    const next = nextUnused();
    if (next === null) return;
    setSlots((current) => current.map((slot, i) => (i === position ? next : slot)));
  };

  const dismiss = (position: number) =>
    setSlots((current) => current.filter((_, i) => i !== position));

  const move = (position: number, by: number) =>
    setSlots((current) => {
      const target = position + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[position], next[target]] = [next[target], next[position]];
      return next;
    });

  if (ranked.length === 0) {
    return (
      <div>
        <p className="text-sm text-text-dim">{t("tonight.empty")}</p>
        <div className="mt-4 flex justify-end">
          <Button variant="quiet" onClick={onBack}>
            {t("tonight.adjust")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {slots.map((slot, position) => {
          const pick = ranked[slot];
          return (
            <li
              key={pick.entry.id}
              className="flex items-start gap-3 rounded-control border border-line bg-surface p-2.5"
            >
              <Link
                to={mediaHref(pick.entry.media)}
                onClick={onClose}
                className="w-[44px] shrink-0 overflow-hidden rounded-[5px]"
                style={{ boxShadow: "var(--rim)" }}
              >
                <CoverImage media={pick.entry.media} lang={lang} className="aspect-2/3 w-full" />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  to={mediaHref(pick.entry.media)}
                  onClick={onClose}
                  className="block truncate font-display text-[13.5px] font-semibold hover:text-stamp-text"
                >
                  {displayTitle(pick.entry.media, lang)}
                </Link>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-dim">
                  {pick.reasons.map((reason) => reasonText(reason, t)).join(" · ")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <QueueButton
                  label={t("tonight.moveUp")}
                  disabled={position === 0}
                  onClick={() => move(position, -1)}
                >
                  <Icon path={ICONS.chevronDown} size={13} className="rotate-180" />
                </QueueButton>
                <QueueButton
                  label={t("tonight.moveDown")}
                  disabled={position === slots.length - 1}
                  onClick={() => move(position, 1)}
                >
                  <Icon path={ICONS.chevronDown} size={13} />
                </QueueButton>
                <QueueButton
                  label={t("tonight.replace")}
                  disabled={nextUnused() === null}
                  onClick={() => replace(position)}
                >
                  <Icon path={ICONS.history} size={13} />
                </QueueButton>
                <QueueButton label={t("tonight.dismiss")} onClick={() => dismiss(position)}>
                  <Icon path={ICONS.close} size={13} />
                </QueueButton>
              </div>
            </li>
          );
        })}
      </ul>

      {slots.length === 0 && <p className="text-sm text-text-dim">{t("tonight.allDismissed")}</p>}

      <div className="mt-4 flex items-center justify-between">
        <Button variant="quiet" onClick={onBack}>
          {t("tonight.adjust")}
        </Button>
        <Button variant="quiet" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </div>
  );
}

function QueueButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex h-7 w-7 items-center justify-center rounded-control text-text-faint",
        "transition-colors hover:bg-bg hover:text-text disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}

function reasonText(reason: Reason, t: (key: string, opts?: Record<string, unknown>) => string): string {
  switch (reason.kind) {
    case "fitEpisodes":
      return t("tonight.reason.fitEpisodes", { count: reason.units, minutes: reason.minutes });
    case "fitChapters":
      return t("tonight.reason.fitChapters", { count: reason.units });
    case "fitMovie":
      return t("tonight.reason.fitMovie", { minutes: reason.minutes });
    case "finishable":
      return t("tonight.reason.finishable", { count: reason.left });
    case "progress":
      return reason.total != null
        ? t("tonight.reason.progressOf", { progress: reason.progress, total: reason.total })
        : t("tonight.reason.progress", { progress: reason.progress });
    case "onHold":
      return t("tonight.reason.onHold", { count: reason.days });
    case "untouched":
      return t("tonight.reason.untouched", { count: reason.days });
    case "friendWatching":
      return t("tonight.reason.friendWatching", { name: reason.name });
    case "friendSent":
      return t("tonight.reason.friendSent", { name: reason.name });
    case "friendLoved":
      return t("tonight.reason.friendLoved", { name: reason.name });
  }
}
