import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Mỗi file src/locales/<lang>/<namespace>.json là một namespace.
const modules = import.meta.glob("./locales/*/*.json", { eager: true });
const resources = {};
for (const [path, mod] of Object.entries(modules)) {
  const [, lang, ns] = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  resources[lang] = resources[lang] || {};
  resources[lang][ns] = mod.default;
}

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem("lb_language") || "vi",
  fallbackLng: "vi",
  defaultNS: "common",
  ns: ["common"],
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export default i18n;
