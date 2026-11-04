import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { ler, gravar } from "../lib/armazenamento.js";

function getSystemDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function aplicar(tema) {
  const isDark = tema === "dark" || (tema === "system" && getSystemDark());
  document.documentElement.classList.toggle("dark", isDark);
}

const OPCOES = [
  { value: "light", Icon: Sun, label: "Claro" },
  { value: "dark", Icon: Moon, label: "Escuro" },
];

export default function ThemeSwitcher() {
  const [tema, setTema] = useState(() => ler("rycs-tema", "light"));

  useEffect(() => {
    aplicar(tema);
  }, [tema]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = () => { if (tema === "system") aplicar("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [tema]);

  const selecionar = (novo) => {
    gravar("rycs-tema", novo);
    setTema(novo);
    aplicar(novo);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      style={{
        display: "inline-flex", alignItems: "center", gap: 2,
        borderRadius: 999, background: "var(--surface-2)",
        border: "1px solid var(--border)", padding: 3,
      }}
    >
      {OPCOES.map(({ value, Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={tema === value}
          title={label}
          onClick={() => selecionar(value)}
          style={{
            width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: tema === value ? "var(--surface)" : "transparent",
            color: tema === value ? "var(--brand)" : "var(--muted)",
            boxShadow: tema === value ? "0 1px 3px rgba(0,0,0,.12)" : "none",
            transition: "background .2s, color .2s, box-shadow .2s",
          }}
        >
          <Icon size={13} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
