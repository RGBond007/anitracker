import { useTranslation } from "react-i18next";

import { useInstance } from "../../features/instance/useInstance";
import { ICONS, Icon, SectionHeading } from "./parts";

const LINKS = [
  { key: "docs", href: "https://github.com/RGBond007/anitrack#readme" },
  { key: "source", href: "https://github.com/RGBond007/anitrack" },
  { key: "licence", href: "https://github.com/RGBond007/anitrack/blob/main/LICENSE" },
] as const;

/** Four facts and three links. Anything more would be a page about a page. */
export function AboutSection() {
  const { t } = useTranslation();
  const { data: instance } = useInstance();

  const facts = [
    { label: t("settings.version"), value: instance?.version ?? "—", mono: true },
    {
      label: t("settings.edition"),
      // The tier is served, not assumed — only the known one gets a nice name.
      value:
        instance?.license_tier === "community"
          ? t("settings.communityEdition")
          : (instance?.license_tier ?? "—"),
    },
    { label: t("settings.telemetry"), value: t("settings.telemetryOff") },
  ];

  return (
    <section>
      <SectionHeading title={t("settings.about")} description={t("settings.aboutHint")} />

      <dl className="divide-y divide-line border-y border-line">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-baseline justify-between gap-6 py-3.5">
            <dt className="text-sm text-text-dim">{fact.label}</dt>
            <dd className={fact.mono ? "tabular text-sm text-text" : "text-sm text-text"}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
        {LINKS.map((link) => (
          <li key={link.key}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-[13px] text-text-dim transition-colors hover:text-stamp-text"
            >
              {t(`settings.link_${link.key}`)}
              <Icon path={ICONS.external} size={13} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
