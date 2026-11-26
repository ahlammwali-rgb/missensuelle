import { useCallback, useEffect, useState } from "react";

export type GcomeLang = "fr" | "ar";

const LANG_STORAGE_KEY = "gcome_lang";
const LANG_EVENT = "gcome-lang-change";

function readInitialGcomeLang(): GcomeLang {
  if (typeof window === "undefined") return "fr";
  try {
    const queryLang = new URLSearchParams(window.location.search).get("lang");
    if (queryLang === "ar" || queryLang === "fr") {
      localStorage.setItem(LANG_STORAGE_KEY, queryLang);
      return queryLang;
    }
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "ar" || stored === "fr") return stored;
  } catch {
    // ignore storage access issues
  }
  return "fr";
}

export function useGcomeLang() {
  const [lang, setLangState] = useState<GcomeLang>(() => readInitialGcomeLang());

  useEffect(() => {
    const syncHandler = (e: Event) => {
      const detail = (e as CustomEvent<GcomeLang>).detail;
      if (detail === "fr" || detail === "ar") {
        setLangState(detail);
      }
    };
    window.addEventListener(LANG_EVENT, syncHandler);
    return () => window.removeEventListener(LANG_EVENT, syncHandler);
  }, []);

  const setLang = useCallback((next: GcomeLang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent<GcomeLang>(LANG_EVENT, { detail: next }));
    } catch {
      // ignore
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "fr" ? "ar" : "fr");
  }, [lang, setLang]);

  const tx = useCallback(
    <T,>(fr: T, ar: T): T => (lang === "ar" ? ar : fr),
    [lang]
  );

  return {
    lang,
    dir: (lang === "ar" ? "rtl" : "ltr") as "rtl" | "ltr",
    isAr: lang === "ar",
    setLang,
    toggleLang,
    tx,
  };
}

export function formatDzdLocale(amount: number, lang: GcomeLang): string {
  const formatted = Math.round(amount).toLocaleString("fr-DZ");
  return lang === "ar" ? `${formatted} دج` : `${formatted} DA`;
}
