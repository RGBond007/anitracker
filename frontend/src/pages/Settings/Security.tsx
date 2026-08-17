import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useChangePassword, useRevokeSessions } from "../../features/auth/useAuth";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import {
  ConfirmDialog,
  SavedNote,
  SectionHeading,
  errorMessage,
  useSavedFlag,
  useUnsavedGuard,
} from "./parts";

const MIN_LENGTH = 8;

/**
 * Two things live here, and one hairline is enough to say they are different:
 * changing this account's password, and ending everyone else's session.
 *
 * Nothing on this screen ever renders a password back — the fields are the only
 * place a value exists, and they are emptied the moment the change lands.
 */
export function SecuritySection() {
  const { t } = useTranslation();
  const password = useChangePassword();
  const revoke = useRevokeSessions();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [confirming, setConfirming] = useState(false);
  const [saved, flashSaved] = useSavedFlag(4000);

  // A half-typed password is worth warning about before it is thrown away.
  useUnsavedGuard(Boolean(form.current || form.next || form.confirm));

  const mismatch = form.confirm.length > 0 && form.confirm !== form.next;
  const tooShort = form.next.length > 0 && form.next.length < MIN_LENGTH;
  const ready =
    form.current.length > 0 && form.next.length >= MIN_LENGTH && form.confirm === form.next;

  const submit = () => {
    if (!ready || password.isPending) return;
    password.mutate(
      { current: form.current, next: form.next },
      {
        onSuccess: () => {
          setForm({ current: "", next: "", confirm: "" });
          flashSaved();
        },
      },
    );
  };

  return (
    <section>
      <SectionHeading title={t("settings.security")} description={t("settings.securityHint")} />

      <form
        className="max-w-sm space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={t("settings.currentPassword")}>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
          />
        </Field>
        <Field
          label={t("settings.newPassword")}
          hint={t("settings.passwordHint")}
          error={tooShort ? t("settings.passwordTooShort") : undefined}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
        </Field>
        <Field
          label={t("settings.confirmPassword")}
          error={mismatch ? t("settings.passwordMismatch") : undefined}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant={ready ? "primary" : "ghost"} disabled={!ready || password.isPending}>
            {password.isPending ? t("settings.saving") : t("settings.changePassword")}
          </Button>
          {saved && <SavedNote />}
        </div>
        {password.error && (
          <p role="alert" className="text-sm text-stamp-text">
            {errorMessage(password.error)}
          </p>
        )}
      </form>

      <div className="mt-10 border-t border-line pt-8">
        <h3 className="text-sm font-medium text-text">{t("settings.sessions")}</h3>
        <p className="mt-1.5 max-w-prose text-[12.5px] leading-relaxed text-text-dim">
          {t("settings.revokeHint")}
        </p>
        {/* Secondary danger: gold-outlined rather than filled, because it is
            recoverable — everyone signs back in. */}
        <Button
          className="mt-4 border-stamp-text/60 text-stamp-text hover:border-stamp-text"
          disabled={revoke.isPending}
          onClick={() => setConfirming(true)}
        >
          {t("settings.revokeOthers")}
        </Button>
        {revoke.error && (
          <p role="alert" className="mt-3 text-sm text-stamp-text">
            {errorMessage(revoke.error)}
          </p>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={t("settings.revokeOthers")}
          body={t("settings.revokeConfirm")}
          confirmLabel={t("settings.revokeOthers")}
          pending={revoke.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => revoke.mutate(undefined, { onSettled: () => setConfirming(false) })}
        />
      )}
    </section>
  );
}
