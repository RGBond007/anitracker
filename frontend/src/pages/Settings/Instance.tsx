import { useState } from "react";
import { useTranslation } from "react-i18next";

import { assessAccent, nearestSafeAccent } from "../../lib/contrast";
import { AccentPreview } from "./AccentPreview";

import { useInstance, useUpdateInstance } from "../../features/instance/useInstance";
import type { Instance } from "../../lib/api-client";
import { Input, Segmented } from "../../components/ui/Input";
import {
  SaveRow,
  SectionHeading,
  SettingRow,
  SettingRows,
  useErrorMessage,
  useSavedFlag,
  useUnsavedGuard,
} from "./parts";

/** The token default, used to seed the picker when the field is left empty. */
const FALLBACK_ACCENT = "#d4af37";
const HEX = /^#[0-9a-fA-F]{6}$/;

type Draft = Pick<Instance, "instance_name" | "logo_url" | "accent_color" | "allow_signup">;

export function InstanceSection() {
  const { data } = useInstance();
  if (!data) return null;
  // The draft is seeded once, inside — the served record stays the baseline the
  // form diffs against, so "changed" survives a refetch.
  return <InstanceForm instance={data} />;
}

function InstanceForm({ instance }: { instance: Instance }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const update = useUpdateInstance({ silent: true });
  const [saved, flashSaved] = useSavedFlag();
  const [draft, setDraft] = useState<Draft>({
    instance_name: instance.instance_name,
    logo_url: instance.logo_url,
    accent_color: instance.accent_color,
    allow_signup: instance.allow_signup,
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const changed = (Object.keys(draft) as (keyof Draft)[]).filter(
    (key) => draft[key] !== instance[key],
  );
  const dirty = changed.length > 0;
  useUnsavedGuard(dirty);

  // Empty means "fall back to .env", which is the documented reset — so only a
  // non-empty value has to look like a colour.
  const accentInvalid = draft.accent_color !== "" && !HEX.test(draft.accent_color);
  const preview = HEX.test(draft.accent_color) ? draft.accent_color : FALLBACK_ACCENT;

  // Judged on the drafted value, not the saved one, and against both themes: an
  // operator picks a colour in whichever theme they happen to be using, and half
  // of their users are in the other. Unsafe is a warning rather than a block —
  // it is their instance, and a rule they cannot overrule is one they will work
  // around by setting the colour in `.env` where nothing checks it at all.
  const verdict = HEX.test(draft.accent_color) ? assessAccent(draft.accent_color) : null;
  const suggestion = verdict && !verdict.safe ? nearestSafeAccent(draft.accent_color) : null;
  const openingSignup = draft.allow_signup && !instance.allow_signup;

  const save = () => {
    if (!dirty || accentInvalid) return;
    update.mutate(
      Object.fromEntries(changed.map((key) => [key, draft[key]])),
      { onSuccess: () => flashSaved() },
    );
  };

  return (
    <section>
      <SectionHeading title={t("settings.instance")} description={t("settings.instanceHint")} />

      <SettingRows>
        <SettingRow label={t("setup.instanceName")} description={t("settings.clearHint")}>
          <Input
            value={draft.instance_name}
            onChange={(e) => set("instance_name", e.target.value)}
          />
        </SettingRow>

        <SettingRow label={t("settings.logoUrl")} description={t("settings.logoUrlHint")}>
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={draft.logo_url}
            onChange={(e) => set("logo_url", e.target.value)}
          />
        </SettingRow>

        <SettingRow
          label={t("setup.accent")}
          description={t("settings.accentHint")}
          // Wider than the other rows: this one carries two theme previews side by
          // side, and at the default 260px each panel is too narrow for its samples
          // to sit on one line.
          controlClassName="sm:w-[420px]"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {/* The swatch is a live preview, so it tracks the field rather
                  than the saved value. */}
              <span
                aria-hidden
                className="h-10 w-10 shrink-0 rounded-control border border-line"
                style={{ backgroundColor: preview }}
              />
              <Input
                className="tabular"
                aria-label={t("setup.accent")}
                value={draft.accent_color}
                spellCheck={false}
                onChange={(e) => set("accent_color", e.target.value)}
              />
              {/* The OS picker, kept to the swatch's size so the row stays calm. */}
              <input
                type="color"
                aria-label={t("settings.accentPicker")}
                value={preview}
                onChange={(e) => set("accent_color", e.target.value)}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-control border border-control-line bg-surface p-1"
              />
            </div>
            {verdict && <AccentPreview accent={draft.accent_color} />}

            {verdict && !verdict.safe && (
              <div role="alert" className="rounded-control border border-stamp-text/50 px-3.5 py-3">
                <p className="text-[12.5px] leading-relaxed text-text">{t("settings.accentUnsafe")}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {verdict.problems.map((problem) => (
                    <li key={problem} className="text-[12px] leading-relaxed text-text-dim">
                      {t(`settings.accentProblem_${problem}`)}
                    </li>
                  ))}
                </ul>
                {suggestion ? (
                  <button
                    type="button"
                    className="mt-2.5 inline-flex items-center gap-2 text-[12.5px] text-text underline-offset-4 hover:underline"
                    onClick={() => set("accent_color", suggestion)}
                  >
                    <span
                      aria-hidden
                      className="h-3.5 w-3.5 rounded-[3px] border border-line"
                      style={{ backgroundColor: suggestion }}
                    />
                    {t("settings.accentUseSafe", { color: suggestion })}
                  </button>
                ) : (
                  // No shade of this hue works. Better said plainly than answered
                  // with a colour they did not choose and would not recognise.
                  <p className="mt-2.5 text-[12px] text-text-faint">{t("settings.accentNoSafe")}</p>
                )}
              </div>
            )}

            {/* Not a failure, so not an alert: the colour works, it simply is not
                being painted exactly as submitted. Saying so beats letting them
                find out from the page. `--stamp-raw` still carries the original. */}
            {verdict && verdict.safe && (verdict.dark.fillAdjusted || verdict.light.fillAdjusted) && (
              <p className="text-[12px] leading-relaxed text-text-faint">
                {t("settings.accentAdjusted")}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              {accentInvalid ? (
                <p className="text-xs text-stamp-text">{t("settings.accentInvalid")}</p>
              ) : (
                <p className="text-xs text-text-faint">
                  {draft.accent_color === "" ? t("settings.accentDefault") : " "}
                </p>
              )}
              <button
                type="button"
                className="shrink-0 text-xs text-text-dim underline-offset-4 hover:text-text hover:underline"
                onClick={() => set("accent_color", "")}
              >
                {t("settings.resetDefault")}
              </button>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          label={t("settings.registration")}
          description={t("settings.registrationHint")}
          status={
            openingSignup ? (
              <p className="text-xs leading-relaxed text-stamp-text">
                {t("settings.registrationWarning")}
              </p>
            ) : null
          }
        >
          <Segmented
            name="registration"
            value={draft.allow_signup ? "open" : "closed"}
            onChange={(v) => set("allow_signup", v === "open")}
            options={[
              { value: "open", label: t("settings.registrationOpen") },
              { value: "closed", label: t("settings.registrationClosed") },
            ]}
          />
        </SettingRow>
      </SettingRows>

      <SaveRow
        label={t("settings.saveInstance")}
        dirty={dirty && !accentInvalid}
        pending={update.isPending}
        saved={saved !== null}
        error={errorMessage(update.error)}
        onSave={save}
      />
    </section>
  );
}
