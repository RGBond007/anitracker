import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import type { ComparisonRow } from "../../lib/api-client";
import {
  useComparison,
  useProfile,
  useSendFriendRequest,
} from "../../features/social/useSocial";
import { useUiStore } from "../../stores/uiStore";
import { PosterGrid, SectionHead } from "../../components/layout/Rail";
import { Poster } from "../../components/media/Poster";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote } from "../../components/ui/EmptyState";
import { Panel, PanelHeader } from "../../components/ui/Panel";
import { PosterGridSkeleton, Skeleton } from "../../components/ui/Skeleton";
import { displayTitle } from "../../lib/titles";
import { Avatar } from "../../components/ui/Avatar";

/**
 * Score agreement, one row per shared title. A dash on either side means that
 * person tracks it but never scored it — which is different from a zero.
 */
function CompareTable({ rows }: { rows: ComparisonRow[] }) {
  const { t } = useTranslation();
  const lang = useUiStore((s) => s.titleLanguage);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">
              {t("compare.title")}
            </th>
            <th className="w-20 px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">
              {t("compare.you")}
            </th>
            <th className="w-20 px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">
              {t("compare.them")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mine = row.mine?.score ?? null;
            const theirs = row.theirs?.score ?? null;
            return (
              <tr key={row.media.provider_id} className="border-b border-line last:border-b-0">
                <td className="max-w-0 truncate px-5 py-2.5">{displayTitle(row.media, lang)}</td>
                <td className="tabular px-3 py-2.5 text-right">{mine ?? "—"}</td>
                <td className="tabular px-3 py-2.5 text-right">{theirs ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { username = "" } = useParams();
  const lang = useUiStore((s) => s.titleLanguage);
  const profile = useProfile(username);
  const send = useSendFriendRequest();

  const visible = profile.data?.visible ?? false;
  const comparison = useComparison(username, visible && profile.data?.relationship !== "self");

  if (profile.isLoading) {
    return (
      <div className="wrap space-y-6 py-8">
        <Skeleton className="h-16 w-64" />
        <PosterGridSkeleton count={6} />
      </div>
    );
  }

  if (profile.error || !profile.data) {
    return (
      <div className="wrap py-10">
        <ErrorNote
          action={<Button onClick={() => void profile.refetch()}>{t("common.retry")}</Button>}
        >
          {t("profile.notFound", { name: username })}
        </ErrorNote>
      </div>
    );
  }

  const p = profile.data;
  const totals = p.anime.total + p.manga.total;

  return (
    <div className="wrap py-8">
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <Avatar user={p.user} size={96} decorative />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-[-0.01em]">{p.user.username}</h1>
          <p className="tabular mt-0.5 text-xs text-text-faint">
            {p.visible ? t("profile.entryCount", { count: totals }) : t("profile.private")}
          </p>
        </div>

        {p.relationship === "none" && (
          <Button
            variant="stamp"
            disabled={send.isPending}
            onClick={() => send.mutate(p.user.username)}
          >
            {t("friends.addAction")}
          </Button>
        )}
        {p.relationship === "pending" && (
          <span className="text-sm text-text-dim">{t("profile.pending")}</span>
        )}
      </header>

      {!p.visible ? (
        <EmptyState>{t("profile.privateExplain", { name: p.user.username })}</EmptyState>
      ) : (
        <>
          {comparison.data && comparison.data.shared.length > 0 && (
            <section className="mb-8 sm:mb-14">
              <SectionHead>{t("compare.heading")}</SectionHead>
              <Panel>
                <PanelHeader
                  right={
                    comparison.data.mean_difference !== null ? (
                      <span className="tabular text-xs text-text-dim">
                        {t("compare.spread", {
                          value: comparison.data.mean_difference.toFixed(2),
                          count: comparison.data.both_scored,
                        })}
                      </span>
                    ) : undefined
                  }
                >
                  {t("compare.sharedCount", { count: comparison.data.shared.length })}
                </PanelHeader>
                <CompareTable rows={comparison.data.shared} />
              </Panel>
            </section>
          )}

          {comparison.data && comparison.data.only_theirs.length > 0 && (
            <section className="mb-8 sm:mb-14">
              <SectionHead>{t("compare.onlyTheirs", { name: p.user.username })}</SectionHead>
              <PosterGrid>
                {comparison.data.only_theirs.slice(0, 18).map((row) => (
                  <Poster
                    key={row.media.provider_id}
                    media={row.media}
                    entry={row.theirs ?? undefined}
                    lang={lang}
                  />
                ))}
              </PosterGrid>
            </section>
          )}

          <section>
            <SectionHead>{t("profile.theirLibrary", { name: p.user.username })}</SectionHead>
            {p.entries.length === 0 ? (
              <EmptyState>{t("profile.emptyList", { name: p.user.username })}</EmptyState>
            ) : (
              <PosterGrid>
                {p.entries.slice(0, 36).map((entry) => (
                  <Poster key={entry.id} media={entry.media} entry={entry} lang={lang} />
                ))}
              </PosterGrid>
            )}
          </section>
        </>
      )}
    </div>
  );
}
