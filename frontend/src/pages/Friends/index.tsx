import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { Friendship, PublicUser } from "../../lib/api-client";
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriends,
  useRemoveFriend,
  useSendFriendRequest,
  useUserSearch,
} from "../../features/social/useSocial";
import { useMe } from "../../features/auth/useAuth";
import { useUiStore } from "../../stores/uiStore";
import { Button } from "../../components/ui/Button";
import { Icon, ICONS } from "../../components/ui/Icon";
import { EmptyState, ErrorNote } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Panel, PanelHeader } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { Avatar } from "../../components/ui/Avatar";
import { FriendsWatching, PersonalPicks, TrustedPick } from "./discovery";
import { ActivityFeed, Discover, Leaderboard } from "./sections";

function PersonRow({
  user,
  subtitle,
  children,
}: {
  user: PublicUser;
  /** Second line under the name — the friend's figures, where we have them. */
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
      <Avatar user={user} size={34} decorative />
      <Link
        to={`/u/${user.username}`}
        className="flex min-w-0 flex-1 flex-col justify-center hover:text-stamp-text pointer-coarse:min-h-[44px]"
      >
        <p className="font-display truncate text-sm font-semibold">{user.username}</p>
        {subtitle && <p className="tabular truncate text-[11px] text-text-faint">{subtitle}</p>}
      </Link>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </li>
  );
}

/** "24 tracked · ★ 8.80 · 6 in common", skipping the parts we do not have. */
function useStatsLine() {
  const { t } = useTranslation();
  return (stats: Friendship["stats"]): string | undefined => {
    if (!stats) return undefined;
    return [
      t("friends.tracked", { count: stats.tracked }),
      stats.mean_score !== null ? `★ ${stats.mean_score.toFixed(2)}` : null,
      stats.in_common > 0 ? t("friends.inCommon", { count: stats.in_common }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };
}

function AddFriend() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const results = useUserSearch(q);
  const send = useSendFriendRequest();

  return (
    <Panel className="mb-8">
      <PanelHeader>{t("friends.add")}</PanelHeader>
      <div className="p-5">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("friends.searchPlaceholder")}
          aria-label={t("friends.searchPlaceholder")}
        />

        {q.trim().length > 0 && (
          <div className="mt-4">
            {results.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : !results.data || results.data.length === 0 ? (
              <p className="text-sm text-text-dim">{t("friends.noMatches", { q })}</p>
            ) : (
              <ul className="rounded-control border border-line">
                {results.data.map((u) => (
                  <PersonRow key={u.id} user={u}>
                    <Button
                      variant="stamp"
                      className="px-3 py-1.5 text-xs"
                      disabled={send.isPending}
                      onClick={() => send.mutate(u.username)}
                    >
                      {t("friends.addAction")}
                    </Button>
                  </PersonRow>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function RequestList({
  title,
  rows,
  incoming,
}: {
  title: string;
  rows: Friendship[];
  incoming: boolean;
}) {
  const { t } = useTranslation();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const remove = useRemoveFriend();

  if (rows.length === 0) return null;

  return (
    <Panel className="mb-8">
      <PanelHeader>{title}</PanelHeader>
      <ul>
        {rows.map((r) => (
          <PersonRow key={r.id} user={r.user}>
            {incoming ? (
              <>
                <Button
                  variant="stamp"
                  className="px-3 py-1.5 text-xs"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate(r.id)}
                >
                  {t("friends.accept")}
                </Button>
                <Button
                  variant="quiet"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => decline.mutate(r.id)}
                >
                  {t("friends.decline")}
                </Button>
              </>
            ) : (
              <Button
                variant="quiet"
                className="px-3 py-1.5 text-xs"
                onClick={() => remove.mutate(r.user.id)}
              >
                {t("friends.cancel")}
              </Button>
            )}
          </PersonRow>
        ))}
      </ul>
    </Panel>
  );
}

export function FriendsPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useFriends();
  const { data: me } = useMe();
  const lang = useUiStore((s) => s.titleLanguage);
  const remove = useRemoveFriend();
  const statsLine = useStatsLine();

  if (isLoading) {
    return (
      <div className="wrap space-y-4 py-8">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wrap py-10">
        <ErrorNote action={<Button onClick={() => void refetch()}>{t("common.retry")}</Button>}>
          {t("friends.loadFailed")}
        </ErrorNote>
      </div>
    );
  }

  return (
    <div className="wrap py-8">
      {/* The heading says whose page this is; the line under it says who can see
          it, which is the one thing worth stating before anything social. */}
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-[19px] font-bold tracking-[-0.01em]">
          {t("nav.friends")}
        </h1>
        <p className="flex items-center gap-1.5 text-[12px] text-text-faint">
          <Icon path={ICONS.eye} size={13} />
          {me?.profile_public ? t("friends.visibleEveryone") : t("friends.visibleFriends")}
        </p>
      </div>

      {/* Requests first: they are the only thing on this page waiting on you. */}
      <RequestList title={t("friends.incoming")} rows={data.incoming} incoming />
      <RequestList title={t("friends.outgoing")} rows={data.outgoing} incoming={false} />

      {/* What friends are for, before the machinery of managing them: one title
          they vouched for, what they are watching, and what that suggests. */}
      <div className="space-y-8">
        <TrustedPick lang={lang} />
        <FriendsWatching lang={lang} />
        <PersonalPicks lang={lang} />
      </div>

      <div className="mt-10">
        <AddFriend />
      </div>
      <Leaderboard />
      <ActivityFeed />

      <Panel>
        <PanelHeader right={<span className="tabular text-xs text-text-faint">{data.friends.length}</span>}>
          {t("friends.yours")}
        </PanelHeader>
        {data.friends.length === 0 ? (
          <div className="p-5">
            <EmptyState>{t("friends.empty")}</EmptyState>
          </div>
        ) : (
          <ul>
            {data.friends.map((f) => (
              <PersonRow key={f.id} user={f.user} subtitle={statsLine(f.stats)}>
                <Link to={`/u/${f.user.username}`}>
                  <Button variant="ghost" className="px-3 py-1.5 text-xs">
                    {t("friends.viewList")}
                  </Button>
                </Link>
                <Button
                  variant="quiet"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => remove.mutate(f.user.id)}
                >
                  {t("friends.remove")}
                </Button>
              </PersonRow>
            ))}
          </ul>
        )}
      </Panel>

      {/* Below the fold on purpose: browsing strangers matters less than the
          people you already added. */}
      <div className="mt-8">
        <Discover />
      </div>
    </div>
  );
}
