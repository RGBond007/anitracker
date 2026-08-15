import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { TitleLanguage, User } from "../../lib/api-client";
import {
  useChangePassword,
  useMe,
  useCreateUser,
  useRevokeSessions,
  useUpdateProfile,
  useUserAdmin,
  useUsers,
} from "../../features/auth/useAuth";
import { useInstance, useUpdateInstance } from "../../features/instance/useInstance";
import { LANGUAGES } from "../../lib/i18n";
import { useUiStore } from "../../stores/uiStore";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input, Segmented, Select } from "../../components/ui/Input";
import { Panel, PanelHeader } from "../../components/ui/Panel";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel>
      <PanelHeader>{title}</PanelHeader>
      <div className="space-y-4 p-5">{children}</div>
    </Panel>
  );
}

function AdminInstance() {
  const { t } = useTranslation();
  const { data: instance } = useInstance();
  const update = useUpdateInstance();
  if (!instance) return null;

  return (
    <Section title={t("settings.instance")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("setup.instanceName")} hint={t("settings.clearHint")}>
          <Input
            defaultValue={instance.instance_name}
            onBlur={(e) =>
              e.target.value !== instance.instance_name &&
              update.mutate({ instance_name: e.target.value })
            }
          />
        </Field>
        <Field label={t("settings.logoUrl")} hint={t("settings.clearHint")}>
          <Input
            defaultValue={instance.logo_url}
            onBlur={(e) =>
              e.target.value !== instance.logo_url && update.mutate({ logo_url: e.target.value })
            }
          />
        </Field>
        <Field label={t("setup.accent")}>
          <div className="flex items-center gap-2">
            <Input
              className="tabular"
              defaultValue={instance.accent_color}
              onBlur={(e) =>
                e.target.value !== instance.accent_color &&
                update.mutate({ accent_color: e.target.value })
              }
            />
            <span
              aria-hidden
              className="h-10 w-10 shrink-0 rounded-control border border-line"
              style={{ backgroundColor: instance.accent_color }}
            />
          </div>
        </Field>
        <Field label={t("settings.registration")} hint={t("settings.registrationHint")}>
          <Segmented
            name="registration"
            value={instance.allow_signup ? "open" : "closed"}
            onChange={(v) => update.mutate({ allow_signup: v === "open" })}
            options={[
              { value: "open", label: t("settings.registrationOpen") },
              { value: "closed", label: t("settings.registrationClosed") },
            ]}
          />
        </Field>
      </div>
    </Section>
  );
}

/**
 * Creating an account on someone's behalf. The generated password is displayed
 * once, here, and never again — the server hashes it and keeps no clear copy, so
 * this panel is the only chance to write it down.
 */
function CreateUser() {
  const { t } = useTranslation();
  const create = useCreateUser();
  const [form, setForm] = useState({ email: "", username: "" });
  const issued = create.data;

  if (issued) {
    return (
      <div className="rounded-control border border-stamp/50 p-4">
        <p className="text-sm">
          {t("settings.createdUser", { name: issued.user.username })}
        </p>
        <p className="mt-2 text-xs text-text-dim">{t("settings.tempOnce")}</p>
        <code className="tabular mt-2 block rounded-control bg-bg px-3 py-2.5 text-sm select-all">
          {issued.temporary_password}
        </code>
        <Button className="mt-3 px-3 py-1.5 text-xs" onClick={() => create.reset()}>
          {t("settings.createAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(form);
      }}
    >
      <Field label={t("auth.username")}>
        <Input
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
      </Field>
      <Field label={t("auth.email")}>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Button
        type="submit"
        variant="stamp"
        disabled={form.username.length < 2 || !form.email.includes("@") || create.isPending}
      >
        {t("settings.createUser")}
      </Button>
      {create.error && (
        <p className="text-sm text-stamp-text sm:col-span-3">
          {(create.error as Error).message}
        </p>
      )}
    </form>
  );
}

function AdminUsers({ me }: { me: User }) {
  const { t } = useTranslation();
  const { data: users } = useUsers();
  const { update, remove } = useUserAdmin();
  const error = update.error ?? remove.error;

  return (
    <Section title={t("settings.users")}>
      <CreateUser />

      <ul className="divide-y divide-line">
        {users?.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div>
              <p>
                {u.username}
                {u.id === me.id && (
                  <span className="ml-2 text-xs text-text-dim">{t("settings.you")}</span>
                )}
              </p>
              <p className="font-mono text-[11px] text-text-faint">
                {u.email} · {u.role}
                {u.must_change_password && ` · ${t("settings.pendingFirstLogin")}`}
              </p>
            </div>
            {u.id !== me.id && (
              <div className="flex gap-3">
                <button
                  className="text-xs text-text-dim hover:text-stamp-text"
                  onClick={() =>
                    update.mutate({
                      id: u.id,
                      patch: { role: u.role === "admin" ? "user" : "admin" },
                    })
                  }
                >
                  {u.role === "admin" ? t("settings.makeUser") : t("settings.makeAdmin")}
                </button>
                <button
                  className="text-xs text-text-dim hover:text-stamp-text"
                  onClick={() =>
                    confirm(t("settings.deleteUserConfirm", { name: u.username })) &&
                    remove.mutate(u.id)
                  }
                >
                  {t("settings.deleteUser")}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-stamp-text">{String(error)}</p>}
    </Section>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const { data: instance } = useInstance();
  const profile = useUpdateProfile();
  const password = useChangePassword();
  const revoke = useRevokeSessions();
  const theme = useUiStore((s) => s.theme);
  const [pw, setPw] = useState({ current: "", next: "" });

  if (!me) return null;

  return (
    <div className="wrap max-w-3xl space-y-5 py-8">
      <h1 className="font-display text-[26px] font-bold tracking-[-0.01em]">{t("settings.title")}</h1>

      <Section title={t("settings.profile")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("auth.username")}>
            <Input
              defaultValue={me.username}
              onBlur={(e) =>
                e.target.value !== me.username && profile.mutate({ username: e.target.value })
              }
            />
          </Field>
          <Field label={t("auth.email")}>
            <Input
              type="email"
              defaultValue={me.email}
              onBlur={(e) => e.target.value !== me.email && profile.mutate({ email: e.target.value })}
            />
          </Field>
        </div>
        {profile.error && <p className="text-sm text-stamp-text">{String(profile.error)}</p>}
      </Section>

      {/* Two columns, not three: at 1280px a third column leaves each control
          ~213px, which is too narrow for a segmented label to survive. */}
      <Section title={t("settings.appearance")}>
        <div className="grid items-start gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label={t("settings.theme")}>
            <Segmented
              name="theme"
              value={theme}
              onChange={(v) => profile.mutate({ theme: v })}
              options={[
                { value: "dark" as const, label: t("settings.dark") },
                { value: "light" as const, label: t("settings.light") },
              ]}
            />
          </Field>

          <Field label={t("settings.titleLanguage")} hint={t("settings.titleLanguageHint")}>
            <Segmented
              name="title-language"
              value={me.title_language}
              onChange={(v) => profile.mutate({ title_language: v as TitleLanguage })}
              options={[
                { value: "romaji", label: "Romaji" },
                { value: "english", label: "English" },
                { value: "native", label: "Native" },
              ]}
            />
          </Field>

          <Field label={t("settings.visibility")} hint={t("settings.visibilityHint")}>
            <Segmented
              name="visibility"
              value={me.profile_public ? "public" : "friends"}
              onChange={(v) => profile.mutate({ profile_public: v === "public" })}
              options={[
                { value: "friends", label: t("settings.visibilityFriends") },
                { value: "public", label: t("settings.visibilityPublic") },
              ]}
            />
          </Field>

          <Field label={t("settings.uiLanguage")}>
            <Select
              value={me.ui_language}
              onChange={(e) => {
                void i18n.changeLanguage(e.target.value);
                profile.mutate({ ui_language: e.target.value });
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title={t("settings.password")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("settings.currentPassword")}>
            <Input
              type="password"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
            />
          </Field>
          <Field label={t("settings.newPassword")} hint={t("setup.passwordHint")}>
            <Input
              type="password"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
            />
          </Field>
        </div>
        <Button
          disabled={pw.next.length < 8 || password.isPending}
          onClick={() =>
            password.mutate(
              { current: pw.current, next: pw.next },
              { onSuccess: () => setPw({ current: "", next: "" }) },
            )
          }
        >
          {t("settings.changePassword")}
        </Button>
        {password.error && <p className="text-sm text-stamp-text">{String(password.error)}</p>}

        <div className="border-t border-line pt-4">
          <p className="text-xs text-text-faint">{t("settings.revokeHint")}</p>
          <Button
            className="mt-2"
            disabled={revoke.isPending}
            onClick={() => confirm(t("settings.revokeConfirm")) && revoke.mutate()}
          >
            {t("settings.revoke")}
          </Button>
        </div>
      </Section>

      {me.role === "admin" && (
        <>
          <AdminInstance />
          <AdminUsers me={me} />
        </>
      )}

      <Section title={t("settings.about")}>
        <p className="font-mono text-xs text-text-dim">
          AniTrack {instance?.version} · {instance?.license_tier} · {t("settings.noTelemetry")}
        </p>
      </Section>
    </div>
  );
}
