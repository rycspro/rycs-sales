import { useState, useEffect } from "react";
import { Sun, Moon, Droplet } from "lucide-react";
import { ler, gravar } from "../lib/armazenamento.js";

// Seletor de VERSÃO de layout (não é mais só tema claro/escuro):
// - sol  → versão nova (a ser criada; por ora cai no visual padrão)
// - agua → versão atual (glass azul claro) — o padrão
// - lua  → versão black (tema escuro)
// A versão vira classe/atributo no <html>: "dark" para a lua, e data-versao
// para quando a versão Sol ganhar estilos próprios.
function aplicar(versao) {
  const isDark = versao === "lua";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.setAttribute("data-versao", versao);
  const bg = isDark ? "#08090C" : versao === "sol" ? "#FAFAFA" : "#CFE1F8";
  document.documentElement.style.background = bg;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

const OPCOES = [
  { value: "sol", Icon: Sun, label: "Sol" },
  { value: "agua", Icon: Droplet, label: "Água" },
  { value: "lua", Icon: Moon, label: "Lua" },
];

export default function ThemeSwitcher() {
  const [versao, setVersao] = useState(() => ler("rycs-versao", "agua"));

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
