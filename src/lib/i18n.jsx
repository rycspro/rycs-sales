// Engine de internacionalização (i18n).
//
// O sistema nasceu com o português escrito direto no código. A tradução entra
// por aqui sem reescrever a arquitetura: um provider guarda o idioma escolhido
// (o mesmo que o seletor de entrada grava), um `t(chave)` busca o texto no
// dicionário do idioma ativo e cai no português quando ainda não há tradução.
// Assim a cobertura cresce idioma por idioma, tela por tela, sem quebrar o que
// já está no ar.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import ptBR from "../i18n/pt-BR.js";
import hi from "../i18n/hi.js";

// Dicionários carregados. Idioma sem entrada aqui usa o português como base.
const DICIONARIOS = { "pt-BR": ptBR, hi };

// Idiomas escritos da direita para a esquerda: o layout inteiro inverte.
const RTL = new Set(["ar", "he", "fa", "ur"]);

const CHAVE = "rycs-idioma";

const I18nContext = createContext(null);

function lerLocaleInicial() {
  try { return window.localStorage?.getItem(CHAVE) || "pt-BR"; } catch { return "pt-BR"; }
}

// "login.titulo" navega no objeto aninhado do dicionário.
function resolver(dic, chave) {
  return chave.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), dic);
}

export function direcao(locale) {
  return RTL.has(locale) ? "rtl" : "ltr";
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(lerLocaleInicial);

  const setLocale = useCallback((novo) => {
    setLocaleState(novo || "pt-BR");
    try { if (novo) window.localStorage?.setItem(CHAVE, novo); } catch { /* storage bloqueado */ }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = locale;
      document.documentElement.dir = direcao(locale);
    } catch { /* sem DOM */ }
  }, [locale]);

  const t = useCallback((chave, vars) => {
    const dic = DICIONARIOS[locale];
    let txt = dic && resolver(dic, chave);
    if (txt == null) txt = resolver(ptBR, chave); // português é a base
    if (txt == null) return chave;                // último recurso: a chave
    if (vars) for (const [k, v] of Object.entries(vars)) txt = txt.split(`{${k}}`).join(v);
    return txt;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ t, locale, setLocale, dir: direcao(locale) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n fora do I18nProvider");
  return ctx;
}
