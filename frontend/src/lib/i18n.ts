import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "../locales/de.json";
import en from "../locales/en.json";

/** Adding a language is a file drop plus one line here — never a component change. */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
] as const;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, de: { translation: de } },
  lng: localStorage.getItem("anitrack-lang") ?? "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("anitrack-lang", lng);
  document.documentElement.lang = lng;
});

export default i18n;
