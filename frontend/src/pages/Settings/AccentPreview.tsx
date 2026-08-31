import { useTranslation } from "react-i18next";

import { UI_CONTRAST, TEXT_CONTRAST, GROUNDS, assessAccent, readableInk, readableOn } from "../../lib/contrast";
import { cx } from "../../lib/cx";

/**
 * What the accent will actually look like, in both themes, before it is saved.
 *
 * The form used to show a single swatch. A swatch is the one thing about a colour
 * that is never in doubt — what an operator cannot see from it is whether the
 * button label on top will be readable, whether the progress bar will be visible
 * against the page, or what either looks like in the theme they are not currently
 * using. So this draws the real surfaces: a filled button, a count badge, a
 * progress bar, an accent-coloured link and a focus ring, twice.
 *
 * The panels are painted from explicit values rather than from the live tokens,
 * because the tokens follow the *saved* accent and this has to show the drafted
 * one — and has to show the other theme at the same time.
 */
export function AccentPreview({ accent }: { accent: string }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Panel accent={accent} theme="dark" label={t("settings.accentPreviewDark")} />
      <Panel accent={accent} theme="light" label={t("settings.accentPreviewLight")} />
    </div>
  );
}

function Panel({ accent, theme, label }: { accent: string; theme: "dark" | "light"; label: string }) {
  const { t } = useTranslation();
  const ground = GROUNDS[theme];
  const verdict = assessAccent(accent);
  const side = verdict[theme];

  // The same derivation `applyAccent` performs, so what is previewed is what the
  // app will paint rather than an approximation of it.
  const fill = readableOn(accent, ground, UI_CONTRAST);
  const ink = readableInk(fill).color;
  const text = readableOn(accent, ground, TEXT_CONTRAST);
  const track = theme === "dark" ? "#28242f" : "#ded7c8";
  const body = theme === "dark" ? "#f1ece1" : "#0d0c10";
  const ring = theme === "dark" ? "#f1ece1" : "#0d0c10";
  const halo = theme === "dark" ? "#0d0c10" : "#f1ece1";

  return (
    <div
      className="rounded-control border border-line p-3.5"
      style={{ backgroundColor: ground }}
      // One label for the group; the samples inside are all decorative, and
      // reading out "Save 3 Continue" as a list of controls would be nonsense.
      role="img"
      aria-label={t("settings.accentPreviewLabel", {
        theme: label,
        ui: side.uiRatio.toFixed(2),
        ink: verdict.ink.ratio.toFixed(2),
      })}
    >
      <p className="font-mono mb-3 text-[10px] uppercase tracking-[0.14em]" style={{ color: text }}>
        {label}
      </p>

      <div aria-hidden className="flex flex-wrap items-center gap-2">
        {/* A filled button — the surface whose label used to be hardcoded dark. */}
        <span
          className="rounded-control px-3 py-1.5 text-[12.5px] font-semibold"
          style={{ backgroundColor: fill, color: ink }}
        >
          {t("settings.accentSampleButton")}
        </span>

        {/* A count badge, the other place text sits on the accent. */}
        <span
          className="font-mono rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: fill, color: ink }}
        >
          3
        </span>

        {/* A chip in its selected state. */}
        <span
          className="rounded-pill border px-2.5 py-1 text-[11.5px]"
          style={{ borderColor: fill, backgroundColor: `${fill}26`, color: body }}
        >
          {t("settings.accentSampleChip")}
        </span>
      </div>

      {/* A progress bar: the accent as a graphical object, which is the job the
          raw gold silently failed in light mode. */}
      <div aria-hidden className="mt-3 h-[6px] w-full overflow-hidden rounded-pill" style={{ backgroundColor: track }}>
        <div className="h-full rounded-pill" style={{ width: "62%", backgroundColor: fill }} />
      </div>

      <div aria-hidden className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[12px] underline underline-offset-2" style={{ color: text }}>
          {t("settings.accentSampleLink")}
        </span>
        {/* The focus ring, which is deliberately *not* drawn from the accent —
            shown here so it is visibly independent of whatever is chosen. */}
        <span
          className="rounded-control px-2 py-1 text-[11px]"
          style={{
            color: body,
            outline: `2px solid ${ring}`,
            outlineOffset: "2px",
            boxShadow: `0 0 0 2px ${halo}`,
          }}
        >
          {t("settings.accentSampleFocus")}
        </span>
      </div>

      <p
        className={cx("font-mono mt-3.5 text-[10px]")}
        style={{ color: side.uiPasses ? text : theme === "dark" ? "#ff8a80" : "#b71c1c" }}
      >
        {t("settings.accentRatios", { ui: side.uiRatio.toFixed(2), ink: verdict.ink.ratio.toFixed(2) })}
      </p>
    </div>
  );
}
