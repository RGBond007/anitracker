import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { Entry, FeedItem, LeaderboardRow } from "../../lib/api-client";
import { useDiscover, useFeed, useLeaderboard, useSendFriendRequest } from "../../features/social/useSocial";
import { useUiStore } from "../../stores/uiStore";
import { CoverImage } from "../../components/media/CoverImage";
import { mediaHref } from "../../components/media/Poster";
import { Button, Chip } from "../../components/ui/Button";
import { Panel, PanelHeader } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { displayTitle } from "../../lib/titles";
import { relativeTime } from "../../lib/time";
import { UserAvatar } from "./avatar";

/**
 * Turns an entry into the sentence a person would say about it. The feed is a
 * list of events, and "taro · 2h ago" alone does not say what happened.
 */
function useActivityLine() {
  const { t } = useTranslation();
  return (entry: Entry): string => {
    const total = entry.media.total_units;
    const unit = entry.media.type === "anime" ? t("feed.ep") : t("feed.ch");
    if (entry.status === "completed") return t("feed.finished");
    if (entry.status === "planned") return t("feed.planned");
    if (entry.status === "dropped") return t("feed.dropped");
    if (entry.status === "on_hold") return t("feed.onHold");
    return total
      ? t("feed.watching", { progress: entry.progress, total, unit })
      : t("feed.watchingNoTotal", { progress: entry.progress, unit });
  };
}

export function ActivityFeed() {
  const { t } = useTranslation();
  const lang = useUiStore((s) => s.titleLanguage);
  const feed = useFeed();
  const line = useActivityLine();

  if (feed.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!feed.data || feed.data.length === 0) return null;

  return (
    <Panel className="mb-8">
      <PanelHeader>{t("friends.activity")}</PanelHeader>
      <ul>
        {feed.data.map((item: FeedItem) => (
          <li key={`${item.user.id}-${item.entry.id}`} className="border-b border-line last:border-b-0">
            <Link
              to={mediaHref(item.entry.media)}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-bg"
            >
              <CoverImage
                media={item.entry.media}
                lang={lang}
                className="h-14 w-[38px] shrink-0 rounded-[4px]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-semibold">{item.user.username}</span>{" "}
                  <span className="text-text-dim">{line(item.entry)}</span>{" "}
                  <span className="font-display font-semibold group-hover:text-stamp-text">
                    {displayTitle(item.entry.media, lang)}
                  </span>
                </p>
                <p className="tabular mt-0.5 text-[11px] text-text-faint">
                  {item.entry.score ? `${t("feed.scored", { score: item.entry.score })} · ` : ""}
                  {relativeTime(item.entry.updated_at, t)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function Discover() {
  const { t } = useTranslation();
  const discover = useDiscover();
  const send = useSendFriendRequest();

  if (discover.isLoading || !discover.data || discover.data.length === 0) return null;

  return (
    <Panel className="mb-8">
      <PanelHeader>{t("friends.discover")}</PanelHeader>
      <ul>
        {discover.data.map(({ user, tracked }) => (
          <li
            key={user.id}
            className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0"
          >
            <UserAvatar name={user.username} />
            <Link
              to={`/u/${user.username}`}
              className="flex min-w-0 flex-1 flex-col justify-center hover:text-stamp-text pointer-coarse:min-h-[44px]"
            >
              <p className="font-display truncate text-sm font-semibold">{user.username}</p>
              <p className="tabular text-[11px] text-text-faint">
                {tracked === null ? t("friends.privateList") : t("friends.tracked", { count: tracked })}
              </p>
            </Link>
            <Button
              variant="stamp"
              className="shrink-0 px-3 py-1.5 text-xs"
              disabled={send.isPending}
              onClick={() => send.mutate(user.username)}
            >
              {t("friends.addAction")}
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

type Metric = "episodes_watched" | "mean_score" | "completed";

export function Leaderboard() {
  const { t } = useTranslation();
  const board = useLeaderboard();
  const [metric, setMetric] = useState<Metric>("episodes_watched");

  if (board.isLoading) return <Skeleton className="mb-8 h-40 w-full" />;
  // One row means it is just you — a ranking of one is not a ranking.
  if (!board.data || board.data.rows.length < 2) return null;

  const rows = [...board.data.rows].sort(
    (a, b) => (b[metric] ?? 0) - (a[metric] ?? 0),
  );
  const top = Math.max(...rows.map((r) => r[metric] ?? 0), 1);

  const value = (row: LeaderboardRow) =>
    metric === "mean_score" ? (row.mean_score?.toFixed(2) ?? "—") : String(row[metric]);

  return (
    <Panel className="mb-8">
      <PanelHeader
        right={
          <div className="flex gap-1.5">
            {(["episodes_watched", "mean_score", "completed"] as Metric[]).map((m) => (
              <Chip
                key={m}
                active={metric === m}
                className="px-2.5 py-1 text-[11px]"
                onClick={() => setMetric(m)}
              >
                {t(`leaderboard.${m}`)}
              </Chip>
            ))}
          </div>
        }
      >
        {t("friends.leaderboard")}
      </PanelHeader>
      <ol className="p-5">
        {rows.map((row, i) => (
          <li key={row.user.id} className="mb-3 flex items-center gap-3 last:mb-0">
            <span className="tabular w-4 shrink-0 text-xs text-text-faint">{i + 1}</span>
            <Link
              to={row.is_self ? "/" : `/u/${row.user.username}`}
              className="w-24 shrink-0 truncate text-sm hover:text-stamp-text"
            >
              {row.is_self ? t("leaderboard.you") : row.user.username}
            </Link>
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-bg">
              <div
                className={row.is_self ? "h-full bg-stamp" : "h-full bg-text-faint"}
                style={{ width: `${Math.max(2, ((row[metric] ?? 0) / top) * 100)}%` }}
              />
            </div>
            <span className="tabular w-14 shrink-0 text-right text-sm">{value(row)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
