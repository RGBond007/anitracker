import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useChangePassword } from "../../features/auth/useAuth";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Panel, PanelHeader } from "../../components/ui/Panel";

/**
 * The only screen an account on a one-time password can reach.
 *
 * There is no navigation and no skip: the API refuses everything else anyway, so
 * offering a way past this would only produce a wall of 403s. The router swaps
 * the whole shell for this rather than rendering it inside the app chrome.
 */
export function ChangePasswordPage() {
  const { t } = useTranslation();
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = current.length > 0 && next.length >= 8 && next === confirm;

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-[9px]">
          <span aria-hidden className="h-6 w-6 rounded-[6px] bg-stamp" />
          <span className="font-display text-[15px] font-bold tracking-[0.02em]">ANITRACK</span>
        </div>

        <Panel>
          <PanelHeader>{t("firstRun.title")}</PanelHeader>
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) change.mutate({ current: current, next });
            }}
          >
            <p className="text-sm text-text-dim">{t("firstRun.explain")}</p>

            <Field label={t("firstRun.temporary")}>
              <Input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>

            <Field
              label={t("settings.newPassword")}
              hint={t("settings.passwordHint")}
              error={tooShort ? t("settings.passwordHint") : undefined}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </Field>

            <Field
              label={t("firstRun.confirm")}
              error={mismatch ? t("firstRun.mismatch") : undefined}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>

            {change.error && (
              <p className="text-sm text-stamp-text">{(change.error as Error).message}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={!ready || change.isPending}
            >
              {t("firstRun.submit")}
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
