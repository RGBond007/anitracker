import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import type { TitleLanguage } from "../../lib/api-client";
import { useSetup } from "../../features/auth/useAuth";
import { LANGUAGES } from "../../lib/i18n";
import { cx } from "../../lib/cx";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input, Select } from "../../components/ui/Input";
import { Panel } from "../../components/ui/Panel";

/** Mirrors the backend's `SetupIn` model — same names, same minimums. */
const setupSchema = z.object({
  email: z.string().email("Enter an email address so you can be identified on this instance."),
  username: z.string().min(2).max(64),
  password: z.string().min(8, "Use at least 8 characters."),
  instance_name: z.string().max(64),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, like #C9A227."),
  title_language: z.enum(["romaji", "english", "native"]),
  ui_language: z.string(),
});

type SetupValues = z.infer<typeof setupSchema>;

const TITLE_SAMPLES: { value: TitleLanguage; label: string; sample: string }[] = [
  { value: "romaji", label: "Romaji", sample: "Sousou no Frieren" },
  { value: "english", label: "English", sample: "Frieren: Beyond Journey's End" },
  { value: "native", label: "Native", sample: "葬送のフリーレン" },
];

export function SetupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setup = useSetup();
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      instance_name: "AniTracker",
      accent_color: "#C9A227",
      title_language: "romaji",
      ui_language: i18n.language,
    },
  });

  const titleLanguage = watch("title_language");
  const accent = watch("accent_color");

  const submit = handleSubmit((values) => {
    setup.mutate(values, { onSuccess: () => navigate("/") });
  });

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <Panel className="w-full max-w-md p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-stamp-text">
          {t("setup.step", { current: step, total: 2 })}
        </p>
        <h1 className="font-display mt-1 text-[26px] font-bold tracking-[-0.01em]">{t("setup.title")}</h1>
        <p className="mt-1 text-sm text-text-dim">{t("setup.subtitle")}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {step === 1 ? (
            <>
              <Field label={t("auth.email")} htmlFor="setup-email" error={errors.email?.message}>
                <Input id="setup-email" type="email" autoComplete="email" {...register("email")} />
              </Field>
              <Field
                label={t("auth.username")}
                htmlFor="setup-username"
                error={errors.username?.message}
              >
                <Input id="setup-username" autoComplete="username" {...register("username")} />
              </Field>
              <Field
                label={t("auth.password")}
                htmlFor="setup-password"
                hint={t("setup.passwordHint")}
                error={errors.password?.message}
              >
                <Input
                  id="setup-password"
                  type="password"
                  autoComplete="new-password"
                  {...register("password")}
                />
              </Field>
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={async () => {
                  if (await trigger(["email", "username", "password"])) setStep(2);
                }}
              >
                {t("setup.continue")}
              </Button>
            </>
          ) : (
            <>
              <Field label={t("setup.instanceName")} htmlFor="setup-instance">
                <Input id="setup-instance" {...register("instance_name")} />
              </Field>

              <Field
                label={t("setup.accent")}
                htmlFor="setup-accent"
                error={errors.accent_color?.message}
              >
                <div className="flex items-center gap-2">
                  <Input id="setup-accent" className="tabular" {...register("accent_color")} />
                  <span
                    aria-hidden
                    className="h-10 w-10 shrink-0 rounded-control border border-line"
                    style={{ backgroundColor: accent }}
                  />
                </div>
              </Field>

              <Field label={t("setup.titleLanguage")}>
                <div className="space-y-px overflow-hidden rounded-control border border-line bg-line">
                  {TITLE_SAMPLES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setValue("title_language", option.value)}
                      className={cx(
                        "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                        titleLanguage === option.value
                          ? "bg-text text-bg"
                          : "bg-surface text-text hover:text-stamp-text",
                      )}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="truncate text-xs opacity-80">{option.sample}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t("setup.uiLanguage")} htmlFor="setup-ui-lang">
                <Select
                  id="setup-ui-lang"
                  {...register("ui_language", {
                    onChange: (e) => void i18n.changeLanguage(e.target.value),
                  })}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {setup.error && <p className="text-sm text-stamp-text">{String(setup.error)}</p>}

              <div className="flex gap-2">
                <Button type="button" variant="quiet" onClick={() => setStep(1)}>
                  {t("common.back")}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  disabled={setup.isPending}
                >
                  {t("setup.finish")}
                </Button>
              </div>
            </>
          )}
        </form>
      </Panel>
    </div>
  );
}
