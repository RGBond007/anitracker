import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useImportJob, useStartImport } from "../../features/media/useImport";
import { Button } from "../../components/ui/Button";
import { Panel, PanelHeader } from "../../components/ui/Panel";

export function ImportPage() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const start = useStartImport();
  const { data: job } = useImportJob(jobId);

  const upload = (file: File) => start.mutate(file, { onSuccess: (created) => setJobId(created.id) });

  const pct = job && job.total ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="wrap max-w-2xl space-y-5 py-8">
      <h1 className="font-display text-[26px] font-bold tracking-[-0.01em]">{t("import.title")}</h1>

      <Panel>
        <PanelHeader>{t("import.upload")}</PanelHeader>
        <div className="space-y-4 p-5">
          <ol className="list-inside list-decimal space-y-1 text-sm text-text-dim">
            <li>{t("import.step1")}</li>
            <li>{t("import.step2")}</li>
            <li>{t("import.step3")}</li>
          </ol>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) upload(file);
            }}
            className={`flex flex-col items-center gap-3 rounded-control border border-dashed px-6 py-12 text-center ${
              dragging ? "border-stamp" : "border-line"
            }`}
          >
            <p className="text-sm text-text-dim">{t("import.dropzone")}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,.gz,application/xml,text/xml,application/gzip"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <Button variant="primary" onClick={() => inputRef.current?.click()}>
              {t("import.choose")}
            </Button>
          </div>

          {start.error && <p className="text-sm text-stamp-text">{String(start.error)}</p>}
        </div>
      </Panel>

      {job && (
        <Panel>
          <PanelHeader
            right={
              <span className="tabular text-xs text-text-dim">
                {job.processed}/{job.total}
              </span>
            }
          >
            {t("import.progress")}
          </PanelHeader>
          <div className="space-y-4 p-5">
            <div
              className="h-1.5 w-full overflow-hidden rounded-sm bg-line"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-stamp" style={{ width: `${pct}%` }} />
            </div>

            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-control border border-line bg-line text-center">
              {(
                [
                  ["import.imported", job.imported],
                  ["import.skipped", job.skipped],
                  ["import.failed", job.failed],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="bg-surface px-3 py-3">
                  <dt className="text-[11px] text-text-faint">
                    {t(key)}
                  </dt>
                  <dd className="font-display mt-1 text-xl font-bold">{value}</dd>
                </div>
              ))}
            </dl>

            <p className="text-sm text-text-dim">
              {job.state === "done"
                ? t("import.done", { imported: job.imported })
                : job.state === "failed"
                  ? (job.error ?? t("import.failedNote"))
                  : t("import.running")}
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
