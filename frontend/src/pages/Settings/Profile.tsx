import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateProfile } from "../../features/auth/useAuth";
import type { User } from "../../lib/api-client";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { AvatarField } from "./AvatarField";
import { SaveRow, SectionHeading, errorMessage, useSavedFlag, useUnsavedGuard } from "./parts";

/** Loose on purpose — the server is the authority, this only catches typos. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileSection({ me }: { me: User }) {
  const { t } = useTranslation();
  // Silent: the confirmation belongs next to the fields that changed, not in a
  // toast at the other end of the screen.
  const update = useUpdateProfile({ silent: true });
  const [draft, setDraft] = useState({ username: me.username, email: me.email });
  const [saved, flashSaved] = useSavedFlag();

  const changed = {
    username: draft.username !== me.username,
    email: draft.email !== me.email,
  };
  const dirty = changed.username || changed.email;
  useUnsavedGuard(dirty);

  // Validation only speaks up about a field the user has actually touched.
  const errors = {
    username:
      changed.username && draft.username.trim().length < 2
        ? t("settings.usernameInvalid")
        : undefined,
    email: changed.email && !EMAIL.test(draft.email) ? t("settings.emailInvalid") : undefined,
  };
  const valid = !errors.username && !errors.email;

  const save = () => {
    if (!dirty || !valid) return;
    update.mutate(
      {
        ...(changed.username ? { username: draft.username.trim() } : {}),
        ...(changed.email ? { email: draft.email.trim() } : {}),
      },
      { onSuccess: () => flashSaved() },
    );
  };

  return (
    <section>
      <SectionHeading title={t("settings.profile")} description={t("settings.profileHint")} />

      {/* The picture belongs with the name and the email: all three are how this
          account appears to other people. */}
      <AvatarField me={me} />

      <form
        className="grid gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label={t("auth.username")} error={errors.username}>
          <Input
            autoComplete="username"
            value={draft.username}
            onChange={(e) => setDraft({ ...draft, username: e.target.value })}
          />
        </Field>
        <Field label={t("auth.email")} error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
        </Field>
        {/* Submit lives outside the grid so it keeps its own width. */}
        <div className="sm:col-span-2">
          <SaveRow
            label={t("settings.saveChanges")}
            dirty={dirty && valid}
            pending={update.isPending}
            saved={saved !== null}
            error={errorMessage(update.error)}
            onSave={save}
          />
        </div>
      </form>
    </section>
  );
}
