import { useState, useEffect, useRef } from "react";
import { SlidersHorizontal, ArrowUp, ArrowDown, X, CalendarDays, ChevronDown } from "lucide-react";

/**
 * FiltroData — botão compacto com dropdown de filtragem por período e classificação.
 *
 * Props:
 *   campos       [{key, label}]  — campos disponíveis para ordenação
 *   campoInicial string          — campo selecionado ao montar (padrão: campos[0])
 *   dirInicial   "asc"|"desc"    — direção inicial (padrão: "desc")
 *   onAplicar    fn({dataInicio, dataFim, campo, direcao}) — callback ao aplicar
 *   onLimpar     fn()            — callback ao limpar
 */
export default function FiltroData({
  campos = [],
  campoInicial = "",
  dirInicial = "desc",
  onAplicar,
  onLimpar,
  variant = "default", // "default" | "btn" (usa o mesmo padrão dos botões vx-btn)
}) {
  const campoDefault = campoInicial || campos[0]?.key || "";
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [campo, setCampo] = useState(campoDefault);
  const [direcao, setDirecao] = useState(dirInicial);
  const [erroData, setErroData] = useState("");
  const [aplicado, setAplicado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  // Reset campo quando os campos disponíveis mudam (troca de aba)
  useEffect(() => {
    setCampo(campoInicial || campos[0]?.key || "");
  }, [campoInicial, campos]);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const validar = () => {
    if (dataInicio && dataFim && dataFim < dataInicio) {
      setErroData("Data final não pode ser anterior à data inicial.");
      return false;
    }
    setErroData("");
    return true;
  };

  const aplicar = () => {
    if (!validar()) return;
    setAplicado(!!(dataInicio || dataFim));
    onAplicar?.({ dataInicio, dataFim, campo, direcao });
    setAberto(false);
  };

  const limpar = () => {
    setDataInicio("");
    setDataFim("");
    setCampo(campoDefault);
    setDirecao(dirInicial);
    setErroData("");
    setAplicado(false);
    onLimpar?.();
    setAberto(false);
  };

  const toggleDir = () => setDirecao((d) => (d === "asc" ? "desc" : "asc"));

  const temFiltro = aplicado && (dataInicio || dataFim);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Botão compacto */}
      {variant === "btn" ? (
        <button
          type="button"
          className="vx-btn"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            borderColor: temFiltro || aberto ? "var(--brand)" : undefined,
            color: temFiltro ? "var(--brand)" : undefined }}
        >
          <SlidersHorizontal size={14} />
          Período{temFiltro ? " · ativo" : ""}
          <ChevronDown size={13} style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s", color: "var(--muted)" }} />
        </button>
      ) : (
        <button
          onClick={() => setAberto((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "7px 12px", borderRadius: 10,
            border: `1.5px solid ${temFiltro ? "var(--brand)" : "var(--border)"}`,
            background: temFiltro ? "var(--brand)0d" : "var(--surface)",
            cursor: "pointer", fontSize: 13, color: temFiltro ? "var(--brand)" : "var(--ink)",
            fontWeight: temFiltro ? 600 : 500, transition: "border-color .15s",
            boxShadow: aberto ? "0 0 0 2px var(--brand)33" : "none",
            borderColor: aberto ? "var(--brand)" : temFiltro ? "var(--brand)" : "var(--border)",
          }}
          onMouseEnter={(e) => { if (!aberto) e.currentTarget.style.borderColor = "var(--brand)"; }}
          onMouseLeave={(e) => { if (!aberto && !temFiltro) e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          <SlidersHorizontal size={14} color={temFiltro ? "var(--brand)" : "var(--muted)"} />
          <span>Período{temFiltro ? " · ativo" : ""}</span>
          <ChevronDown size={13} color="var(--muted)" style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>
      )}

      {/* Dropdown */}
      {aberto && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          minWidth: 320, padding: "16px",
        }}>
          {/* Período */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              {/* Data início */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" }}>DE</label>
                <div style={{ position: "relative" }}>
                  <CalendarDays size={13} color="var(--muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    type="date"
                    value={dataInicio}
                    max={dataFim || undefined}
                    onChange={(e) => { setDataInicio(e.target.value); setErroData(""); }}
                    style={{
                      width: "100%", padding: "7px 10px 7px 30px",
                      border: "1.5px solid var(--border)", borderRadius: 8,
                      fontSize: 13, fontFamily: "inherit", color: "var(--ink)",
                      background: "var(--surface-2)", outline: "none", boxSizing: "border-box", cursor: "pointer",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                  />
                </div>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13, paddingBottom: 8, flexShrink: 0 }}>→</span>
              {/* Data fim */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" }}>ATÉ</label>
                <div style={{ position: "relative" }}>
                  <CalendarDays size={13} color="var(--muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    type="date"
                    value={dataFim}
                    min={dataInicio || undefined}
                    onChange={(e) => { setDataFim(e.target.value); setErroData(""); }}
                    style={{
                      width: "100%", padding: "7px 10px 7px 30px",
                      border: "1.5px solid var(--border)", borderRadius: 8,
                      fontSize: 13, fontFamily: "inherit", color: "var(--ink)",
                      background: "var(--surface-2)", outline: "none", boxSizing: "border-box", cursor: "pointer",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                  />
                </div>
              </div>
            </div>

            {/* Classificar por */}
            {campos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" }}>CLASSIFICAR POR</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select
                    value={campo}
                    onChange={(e) => setCampo(e.target.value)}
                    style={{
                      flex: 1, padding: "7px 10px",
                      border: "1.5px solid var(--border)", borderRadius: 8,
                      fontSize: 13, fontFamily: "inherit", color: "var(--ink)",
                      background: "var(--surface-2)", outline: "none", cursor: "pointer",
                      appearance: "none", WebkitAppearance: "none",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                  >
                    {campos.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={toggleDir}
                    title={direcao === "asc" ? "Crescente — clique para decrescente" : "Decrescente — clique para crescente"}
                    style={{
                      width: 36, height: 36, flexShrink: 0,
                      border: "1.5px solid var(--border)", borderRadius: 8,
                      background: "var(--surface-2)", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--ink)", transition: "border-color .15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  >
                    {direcao === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Erro */}
          {erroData && (
            <div style={{ marginBottom: 10, fontSize: 12, color: "#DC2626" }}>{erroData}</div>
          )}

          {/* Botões */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {(dataInicio || dataFim || aplicado) && (
              <button
                onClick={limpar}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "7px 12px", fontSize: 13, fontFamily: "inherit",
                  border: "1.5px solid var(--border)", borderRadius: 8,
                  background: "var(--surface-2)", color: "var(--muted)",
                  cursor: "pointer",
                }}
              >
                <X size={12} /> Limpar
              </button>
            )}
            <button
              onClick={aplicar}
              style={{
                padding: "7px 16px", fontSize: 13, fontFamily: "inherit", fontWeight: 600,
                border: "none", borderRadius: 8,
                background: "var(--brand)", color: "#fff",
                cursor: "pointer",
              }}
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper exportado para filtrar listas por criadoEm ───────────────────────
export function filtrarPorPeriodo(lista, filtro) {
  if (!filtro || (!filtro.dataInicio && !filtro.dataFim)) return lista;
  const ini = filtro.dataInicio ? new Date(filtro.dataInicio).getTime() : 0;
  const fim = filtro.dataFim ? new Date(filtro.dataFim + "T23:59:59").getTime() : Infinity;
  return lista.filter((item) => {
    const ts = Number(item.criadoEm || item.dataInicio || item.criadoEm || 0);
    return ts >= ini && ts <= fim;
  });
}

export function ordenarLista(lista, filtro) {
  if (!filtro?.campo) return lista;
  const { campo, direcao } = filtro;
  return [...lista].sort((a, b) => {
    const va = a[campo] ?? "";
    const vb = b[campo] ?? "";
    let cmp;
    if (typeof va === "number" && typeof vb === "number") {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
    }
    return direcao === "asc" ? cmp : -cmp;
  });
}
