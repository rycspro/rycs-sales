import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { ler, gravar } from "../lib/armazenamento.js";

// Duas versões:
// - sol → versão clara/clean (padrão)
// - lua → a MESMA versão do Sol, porém escura (black)
// Ambas usam o layout do Sol (data-versao="sol"); a lua acende data-dark="1",
// que aplica a paleta escura por cima do Sol.
function aplicar(versao) {
  const isDark = versao === "lua";
  document.documentElement.setAttribute("data-versao", "sol");
  document.documentElement.classList.remove("dark"); // não usar o tema escuro antigo (glass)
  if (isDark) document.documentElement.setAttribute("data-dark", "1");
  else document.documentElement.removeAttribute("data-dark");
  const bg = isDark ? "#0E1014" : "#FAFAFA";
  document.documentElement.style.background = bg;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

const OPCOES = [
  { value: "sol", Icon: Sun, label: "Sol" },
  { value: "lua", Icon: Moon, label: "Lua" },
];

export default function ThemeSwitcher() {
  // Versões antigas podem ter salvo "agua" — passa a valer Sol.
  const [versao, setVersao] = useState(() => (ler("rycs-versao", "sol") === "lua" ? "lua" : "sol"));

  useEffect(() => {
    aplicar(versao);
  }, [versao]);

  const selecionar = (novo) => {
    gravar("rycs-versao", novo);
    setVersao(novo);
    aplicar(novo);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Versão do layout"
      style={{
        display: "inline-flex", alignItems: "center", gap: 2,
        borderRadius: 999, background: "var(--surface-2)",
        border: "1px solid var(--glass-border, var(--border))", padding: 3,
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
      }}
    >
      {OPCOES.map(({ value, Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={versao === value}
          title={label}
          aria-label={label}
          onClick={() => selecionar(value)}
          style={{
            width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: versao === value ? "var(--surface-solid, var(--surface))" : "transparent",
            color: versao === value ? "var(--brand)" : "var(--muted)",
            boxShadow: versao === value ? "0 1px 4px rgba(0,0,0,.1)" : "none",
            transition: "background .2s, color .2s, box-shadow .2s",
          }}
        >
          <Icon size={13} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
