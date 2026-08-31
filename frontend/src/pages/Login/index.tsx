import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DEFAULT_INSTANCE_NAME, usesBuiltInBrand } from "../../lib/brand";

import { useInstance } from "../../features/instance/useInstance";
import { useLogin, useRegister } from "../../features/auth/useAuth";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Panel } from "../../components/ui/Panel";
import { useErrorMessage } from "../../lib/useErrorMessage";

export function LoginPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const { data: instance } = useInstance();
  const login = useLogin();
  const register = useRegister();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ identifier: "", email: "", username: "", password: "" });

  const pending = login.isPending || register.isPending;
  const error = login.error ?? register.error;
  const instanceName = instance?.instance_name ?? DEFAULT_INSTANCE_NAME;
  const usesDefaultBrand = usesBuiltInBrand(instanceName, instance?.logo_url);

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
        {usesDefaultBrand && (
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="AniTracker"
            className="brand-dark-only h-auto w-full max-w-[260px]"
          />
        )}
        <h1 className={`${usesDefaultBrand ? "brand-light-only " : ""}font-display text-[22px] font-bold tracking-[-0.01em]`}>
          {instanceName}
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

          {error && (
            <p role="alert" className="text-sm text-stamp-text">
              {errorMessage(error)}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            pending={pending}
            pendingLabel={t("common.signingIn")}
          >
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
