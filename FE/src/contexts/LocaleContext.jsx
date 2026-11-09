import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import i18n from "../i18n";

const LANGUAGE_OPTIONS = [
  { code: "vi", label: "Tiếng Việt", locale: "vi-VN", currency: "VND" },
  { code: "en", label: "English", locale: "en-US", currency: "USD" },
  { code: "fr", label: "Français", locale: "fr-FR", currency: "EUR" },
  { code: "ja", label: "日本語", locale: "ja-JP", currency: "JPY" },
  { code: "ko", label: "한국어", locale: "ko-KR", currency: "KRW" },
];

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [language, setLanguageState] = useState(
    () => localStorage.getItem("lb_language") || "vi",
  );
  const [rates, setRates] = useState(null);
  const [rateError, setRateError] = useState("");
  const current = LANGUAGE_OPTIONS.find((option) => option.code === language) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    let active = true;
    api.get("/wallet/exchange-rates")
      .then(({ data }) => {
        if (active) {
          setRates(data.rates);
          setRateError("");
        }
      })
      .catch((error) => {
        if (active) {
          setRateError(error.response?.data?.message || "Không tải được tỷ giá.");
        }
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    document.documentElement.lang = current.locale;
  }, [current.locale]);

  const setLanguage = useCallback((code) => {
    if (!LANGUAGE_OPTIONS.some((option) => option.code === code)) return;
    localStorage.setItem("lb_language", code);
    i18n.changeLanguage(code);
    setLanguageState(code);
  }, []);

  const t = useCallback(
    (key, fallback = key) => i18n.t(key, { defaultValue: fallback, lng: language }),
    [language],
  );
  const formatCurrency = useCallback((amountVnd) => {
    const amount = Number(amountVnd || 0);
    const hasRate = current.currency === "VND" || Number.isFinite(rates?.[current.currency]);
    const displayCurrency = hasRate ? current.currency : "VND";
    const displayLocale = hasRate ? current.locale : "vi-VN";
    const converted = displayCurrency === "VND" ? amount : amount * rates[displayCurrency];
    return new Intl.NumberFormat(displayLocale, {
      style: "currency",
      currency: displayCurrency,
      maximumFractionDigits: ["JPY", "KRW", "VND"].includes(displayCurrency) ? 0 : 2,
    }).format(converted);
  }, [current, rates]);
  const formatDateTime = useCallback(
    (value) => new Intl.DateTimeFormat(current.locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value)),
    [current.locale],
  );

  const value = useMemo(() => ({
    language,
    languages: LANGUAGE_OPTIONS,
    setLanguage,
    t,
    formatCurrency,
    formatDateTime,
    currency: current.currency,
    rateError,
  }), [language, setLanguage, t, formatCurrency, formatDateTime, current.currency, rateError]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
