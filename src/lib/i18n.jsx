import { createContext, useContext, useState, useCallback, useMemo } from "react";

const SUPPORTED = ["en", "pt-BR", "hi"];
const DEFAULT_LANG = "en";
const STORAGE_KEY = "rycs_lang";

function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {}
  const nav = navigator.language || navigator.userLanguage || "";
  if (nav.startsWith("pt")) return "pt-BR";
  if (nav.startsWith("hi")) return "hi";
  return DEFAULT_LANG;
}

const I18nCtx = createContext(null);

let _dictionaries = {};

export function registerLocale(code, dict) {
  _dictionaries[code] = dict;
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  const setLang = useCallback((code) => {
    if (!SUPPORTED.includes(code)) return;
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  }, []);

  const t = useCallback((key, params) => {
    const dict = _dictionaries[lang] || _dictionaries[DEFAULT_LANG] || {};
    const fallback = _dictionaries[DEFAULT_LANG] || {};
    let text = dict[key] ?? fallback[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      });
    }
    return text;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, SUPPORTED }), [lang, setLang, t]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}

export const LANG_LABELS = { en: "English", "pt-BR": "Português", hi: "हिन्दी" };
