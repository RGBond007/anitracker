import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import type { EntryStatus, MediaType } from "../../lib/api-client";
import { useEntries } from "../../features/media/useMedia";
import { useUiStore } from "../../stores/uiStore";
import { useStatusLabel } from "../../components/media/statusLabels";
import { PosterGrid, SectionHead } from "../../components/layout/Rail";
import { Button, Chip } from "../../components/ui/Button";
import { PosterRow } from "../../components/media/PosterRow";
import { FranchiseCard } from "../../components/media/FranchiseCard";
import { groupByFranchise } from "../../lib/franchise";
import { EmptyState } from "../../components/ui/EmptyState";
import { PosterGridSkeleton } from "../../components/ui/Skeleton";
import { Segmented, Select } from "../../components/ui/Input";

const STATUSES: EntryStatus[] = ["current", "completed", "on_hold", "dropped", "planned"];

export function ListViewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status = "current" } = useParams<{ status: EntryStatus }>();
  const lang = useUiStore((s) => s.titleLanguage);
  const setListTab = useUiStore((s) => s.setListTab);
  const statusLabel = useStatusLabel();

  const view = useUiStore((s) => s.libraryView);
  const setView = useUiStore((s) => s.setLibraryView);
  const [type, setType] = useState<MediaType>("anime");
  const [sort, setSort] = useState("updated");

  useEffect(() => setListTab(status), [status, setListTab]);

  const { data, isLoading } = useEntries({ type, status: status as EntryStatus, sort });

  return (
    <div className="wrap py-8">
      <SectionHead>{t("nav.library")}</SectionHead>

      {/* Statuses scroll rather than wrap: five chips plus a type toggle plus a
          sort control wrapped to three ragged rows on a phone, which cost ~200px
          of screen before a single cover appeared. */}
      <div className="rail -mx-5 mb-3 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
        {STATUSES.map((s) => (
          <Chip
            key={s}
            className="shrink-0"
            active={s === status}
            onClick={() => navigate(`/list/${s}`)}
          >
            {statusLabel(s, type)}
          </Chip>
        ))}
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Segmented
          name="media-type"
          className="w-[132px] shrink-0"
          value={type}
          onChange={(v) => setType(v as MediaType)}
          options={[
            { value: "anime", label: t("common.anime") },
            { value: "manga", label: t("common.manga") },
          ]}
        />

        <Select
          aria-label={t("list.sort")}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="min-w-0 flex-1"
        >
          <option value="updated">{t("list.sortUpdated")}</option>
          <option value="title">{t("list.sortTitle")}</option>
          <option value="score">{t("list.sortScore")}</option>
          <option value="progress">{t("list.sortProgress")}</option>
        </Select>

        <button
          type="button"
          aria-label={t(view === "grid" ? "list.viewList" : "list.viewGrid")}
          title={t(view === "grid" ? "list.viewList" : "list.viewGrid")}
          onClick={() => setView(view === "grid" ? "list" : "grid")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-control-line text-text-dim transition-colors hover:text-text"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {view === "grid" ? (
              <>
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </>
            ) : (
              <>
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </>
            )}
          </svg>
        </button>
      </div>

      {isLoading ? (
        <PosterGridSkeleton />
      ) : !data || data.length === 0 ? (
        <EmptyState
          action={
            <Button variant="primary" onClick={() => navigate("/search")}>
              {t("list.emptyCta")}
            </Button>
          }
        >
          {t("list.empty")}
        </EmptyState>
      ) : view === "list" ? (
        <div>
          {data.map((entry) => (
            <PosterRow key={entry.id} entry={entry} lang={lang} />
          ))}
        </div>
      ) : (
        // One card per show. A season that is not part of a chain is a chain of
        // one, so nothing is lost by always grouping.
        <PosterGrid>
          {groupByFranchise(data).map((franchise) => (
            <FranchiseCard key={franchise.key} franchise={franchise} lang={lang} />
          ))}
        </PosterGrid>
      )}
    </div>
  );
}
