import { useState, useEffect } from "react";
import { SlidersHorizontal, ArrowUp, ArrowDown, X, CalendarDays } from "lucide-react";

/**
 * FiltroData — componente de filtragem por período e classificação.
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
}) {
  const campoDefault = campoInicial || campos[0]?.key || "";
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [campo, setCampo] = useState(campoDefault);
  const [direcao, setDirecao] = useState(dirInicial);
  const [erroData, setErroData] = useState("");
  const [aplicado, setAplicado] = useState(false);

  // Reset campo quando os campos disponíveis mudam (troca de aba)
  useEffect(() => {
    setCampo(campoInicial || campos[0]?.key || "");
  }, [campoInicial, campos]);

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
  };

  const limpar = () => {
    setDataInicio("");
    setDataFim("");
    setCampo(campoDefault);
    setDirecao(dirInicial);
    setErroData("");
    setAplicado(false);
    onLimpar?.();
  };

  const toggleDir = () => setDirecao((d) => (d === "asc" ? "desc" : "asc"));

  const temFiltro = aplicado && (dataInicio || dataFim);

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "12px 16px",
      marginBottom: 18,
      boxShadow: "0 1px 3px rgba(0,0,0,.04)",
    }}>
      {/* Cabeçalho da linha */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <SlidersHorizontal size={14} color="var(--muted)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" }}>
          FILTRAR E CLASSIFICAR
        </span>
        {temFiltro && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#2563EB",
            background: "#EFF6FF", borderRadius: 20,
            padding: "2px 8px", letterSpacing: 0,
          }}>
            filtro ativo
          </span>
        )}
      </div>

      {/* Campos */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap",
      }}>
        {/* Data início */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" }}>
            DE
          </label>
          <div style={{ position: "relative" }}>
            <CalendarDays size={13} color="var(--muted)" style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none",
            }} />
            <input
              type="date"
              value={dataInicio}
              max={dataFim || undefined}
              onChange={(e) => { setDataInicio(e.target.value); setErroData(""); }}
              style={{
                width: "100%", padding: "7px 10px 7px 30px",
                border: "1.5px solid var(--border)", borderRadius: 8,
                fontSize: 13, fontFamily: "inherit", color: "var(--ink)",
                background: "var(--surface-2)", outline: "none",
                boxSizing: "border-box", cursor: "pointer",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>
        </div>

        {/* Separador */}
        <div style={{ color: "var(--muted)", fontSize: 13, paddingBottom: 8, flexShrink: 0 }}>→</div>

        {/* Data fim */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" }}>
            ATÉ
          </label>
          <div style={{ position: "relative" }}>
            <CalendarDays size={13} color="var(--muted)" style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none",
            }} />
            <input
              type="date"
              value={dataFim}
              min={dataInicio || undefined}
              onChange={(e) => { setDataFim(e.target.value); setErroData(""); }}
              style={{
                width: "100%", padding: "7px 10px 7px 30px",
                border: "1.5px solid var(--border)", borderRadius: 8,
                fontSize: 13, fontFamily: "inherit", color: "var(--ink)",
                background: "var(--surface-2)", outline: "none",
                boxSizing: "border-box", cursor: "pointer",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>
        </div>

        {/* Separador visual */}
        {campos.length > 0 && (
          <div style={{
            width: 1, height: 36, background: "var(--border)",
            alignSelf: "flex-end", flexShrink: 0, margin: "0 2px",
          }} />
        )}

        {/* Classificar por */}
        {campos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" }}>
              CLASSIFICAR POR
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <select
                value={campo}
                onChange={(e) => setCampo(e.target.value)}
                style={{
                  flex: 1, padding: "7px 10px",
                  border: "1.5px solid var(--border)", borderRadius: 8,
                  fontSize: 13, fontFamily: "inherit", color: "var(--ink)",
                  background: "var(--surface-2)", outline: "none",
                  cursor: "pointer",
                  appearance: "none", WebkitAppearance: "none",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              >
                {campos.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              {/* Botão asc/desc */}
              <button
                onClick={toggleDir}
                title={direcao === "asc" ? "Crescente — clique para decrescente" : "Decrescente — clique para crescente"}
                style={{
                  width: 36, height: 36, flexShrink: 0,
                  border: "1.5px solid var(--border)", borderRadius: 8,
                  background: "var(--surface-2)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--ink)", transition: "border-color .15s, background .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; e.currentTarget.style.background = "var(--surface)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface-2)"; }}
              >
                {direcao === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Botões */}
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", paddingBottom: 0, flexShrink: 0 }}>
          {(dataInicio || dataFim || aplicado) && (
            <button
              onClick={limpar}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 12px", fontSize: 13, fontFamily: "inherit",
                border: "1.5px solid var(--border)", borderRadius: 8,
                background: "var(--surface-2)", color: "var(--muted)",
                cursor: "pointer", transition: "border-color .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <X size={12} />
              Limpar
            </button>
          )}
          <button
            onClick={aplicar}
            style={{
              padding: "7px 16px", fontSize: 13, fontFamily: "inherit", fontWeight: 600,
              border: "none", borderRadius: 8,
              background: "var(--brand)", color: "#fff",
              cursor: "pointer", transition: "opacity .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Aplicar filtros
          </button>
        </div>
      </div>

      {/* Erro de validação */}
      {erroData && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#DC2626" }}>{erroData}</div>
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
