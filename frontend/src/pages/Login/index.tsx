import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useInstance } from "../../features/instance/useInstance";
import { useLogin, useRegister } from "../../features/auth/useAuth";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Panel } from "../../components/ui/Panel";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: instance } = useInstance();
  const login = useLogin();
  const register = useRegister();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ identifier: "", email: "", username: "", password: "" });

  const pending = login.isPending || register.isPending;
  const error = login.error ?? register.error;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const done = { onSuccess: () => navigate("/") };
    if (mode === "login") {
      login.mutate({ identifier: form.identifier, password: form.password }, done);
    } else {
      register.mutate(
        { email: form.email, username: form.username, password: form.password },
        done,
      );
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <Panel className="w-full max-w-sm p-6">
        <h1 className="font-display text-[22px] font-bold tracking-[-0.01em]">
          {instance?.instance_name ?? "AniTrack"}
        </h1>
        <p className="mt-1 text-sm text-text-dim">{t("auth.subtitle")}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "login" ? (
            <Field label={t("auth.identifier")} htmlFor="identifier">
              <Input
                id="identifier"
                autoComplete="username"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              />
            </Field>
          ) : (
            <>
              <Field label={t("auth.email")} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label={t("auth.username")} htmlFor="username">
                <Input
                  id="username"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </Field>
            </>
          )}

          <Field label={t("auth.password")} htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          {error && <p className="text-sm text-stamp-text">{String(error)}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={pending}>
            {mode === "login" ? t("auth.login") : t("auth.createAccount")}
          </Button>

          {instance?.allow_signup ? (
            <button
              type="button"
              className="w-full text-xs text-text-dim hover:text-text"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}
            </button>
          ) : (
            mode === "login" && (
              <p className="text-center text-xs text-text-dim">{t("auth.signupClosed")}</p>
            )
          )}
        </form>
      </Panel>
    </div>
  );
}
