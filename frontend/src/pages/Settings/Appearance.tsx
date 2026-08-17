import { useTranslation } from "react-i18next";

import { useUpdateProfile } from "../../features/auth/useAuth";
import type { TitleLanguage, User } from "../../lib/api-client";
import { LANGUAGES } from "../../lib/i18n";
import { useUiStore } from "../../stores/uiStore";
import { Segmented, Select } from "../../components/ui/Input";
import {
  SavedNote,
  SectionHeading,
  SettingRow,
  SettingRows,
  errorMessage,
  useSavedFlag,
} from "./parts";

/**
 * Preferences that take effect the moment they change, so there is nothing to
 * save: a theme switch you have to confirm is a theme switch you cannot preview.
 * Each row confirms itself instead, with a tick that fades after two seconds.
 */
export function AppearanceSection({ me }: { me: User }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateProfile({ silent: true });
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  // The tick lands on the row that saved, and only for as long as it is useful.
  const [savedKey, flashSaved] = useSavedFlag();
  const status = (key: string) => (savedKey === key ? <SavedNote /> : null);

  return (
    <section>
      <SectionHeading title={t("settings.appearance")} description={t("settings.appearanceHint")} />

      <SettingRows>
        <SettingRow
          label={t("settings.theme")}
          description={t("settings.themeHint")}
          status={status("theme")}
        >
          <Segmented
            name="theme"
            value={theme}
            onChange={(v) => {
              // Applied locally first: the repaint should not wait on a round trip.
              setTheme(v);
              update.mutate({ theme: v }, { onSuccess: () => flashSaved("theme") });
            }}
            options={[
              { value: "dark" as const, label: t("settings.dark") },
              { value: "light" as const, label: t("settings.light") },
            ]}
          />
        </SettingRow>

        <SettingRow
          label={t("settings.titleLanguage")}
          description={t("settings.titleLanguageHint")}
          status={status("title_language")}
        >
          <Segmented
            name="title-language"
            value={me.title_language}
            onChange={(v) =>
              update.mutate(
                { title_language: v as TitleLanguage },
                { onSuccess: () => flashSaved("title_language") },
              )
            }
            options={[
              { value: "romaji", label: "Romaji" },
              { value: "english", label: "English" },
              { value: "native", label: "Native" },
            ]}
          />
        </SettingRow>

        <SettingRow
          label={t("settings.uiLanguage")}
          description={t("settings.uiLanguageHint")}
          status={status("ui_language")}
        >
          <Select
            value={me.ui_language}
            onChange={(e) => {
              void i18n.changeLanguage(e.target.value);
              update.mutate(
                { ui_language: e.target.value },
                { onSuccess: () => flashSaved("ui_language") },
              );
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </SettingRow>

        <SettingRow
          label={t("settings.visibility")}
          description={t("settings.visibilityHint")}
          status={status("profile_public")}
        >
          <Segmented
            name="visibility"
            value={me.profile_public ? "public" : "friends"}
            onChange={(v) =>
              update.mutate(
                { profile_public: v === "public" },
                { onSuccess: () => flashSaved("profile_public") },
              )
            }
            options={[
              { value: "friends", label: t("settings.visibilityFriends") },
              { value: "public", label: t("settings.visibilityPublic") },
            ]}
          />
        </SettingRow>
      </SettingRows>

      {update.error && (
        <p role="alert" className="mt-4 text-sm text-stamp-text">
          {errorMessage(update.error)}
        </p>
      )}
    </section>
  );
}
