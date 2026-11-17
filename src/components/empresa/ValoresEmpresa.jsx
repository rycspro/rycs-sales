import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, Banknote, Calculator, Check, CheckCircle2, ChevronRight,
  CircleDollarSign, FileText, Info, Megaphone, Percent, ReceiptText,
  Settings2, SlidersHorizontal, Sparkles, TrendingUp, User, Wallet, X,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { sugerirValores } from "../../../shared/valorTarefa.js";

function formatarBRL(valor) {
  if (!valor && valor !== 0) return "";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(str) {
  if (!str) return 0;
  return Number(String(str).replace(/\./g, "").replace(",", ".")) || 0;
}

const ACOES_SEM_VENDA = ORDEM_ACOES.filter((k) => k !== "venda");

const mapaParaStrings = (obj = {}) =>
  Object.fromEntries(ORDEM_ACOES.map((k) => [k, obj?.[k] != null ? formatarBRL(obj[k]) : ""]));

const numeroOuNulo = (s) => {
  const t = String(s ?? "").trim();
  return t === "" ? null : parseBRL(t);
};
const numeroBase = (v) => (v == null ? null : Number(v));

const tarefasIguais = (a = {}, b = {}) => {
  const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of ks) if (Number(a?.[k] || 0) !== Number(b?.[k] || 0)) return false;
  return true;
};

function stringsParaMapa(strings, chaves = ORDEM_ACOES) {
  const limpo = {};
  for (const k of chaves) {
    const s = String(strings?.[k] ?? "").trim();
    if (s === "") continue;
    const num = parseBRL(s);
    if (num >= 0) limpo[k] = num;
  }
  return limpo;
}

const parseNumPt = (s) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;

// ── Micro-componentes reutilizáveis ─────────────────────────────────────────

function InputMoeda({ value, onChange, disabled, autoFocus }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", pointerEvents: "none" }}>R$</span>
      <input
        className="vx-input vx-mono" inputMode="decimal" disabled={disabled} autoFocus={autoFocus}
        style={{ paddingLeft: 32, opacity: disabled ? 0.55 : 1 }}
        value={value} placeholder="0,00"
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
      />
    </div>
  );
}

function Segmentado({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", padding: 3, gap: 3, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value} type="button" onClick={() => onChange(o.value)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 8,
              border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
              background: on ? "var(--brand)" : "transparent", color: on ? "#fff" : "var(--muted)", transition: "all .16s",
            }}
          >
            {o.icon}{o.label}
          </button>
        );
      })}
    </div>
  );
}

function SkeletonLine({ width = "60%", height = 14 }) {
  return <div className="vx-skeleton" style={{ width, height, borderRadius: 6 }} />;
}

// ── SEÇÃO 1: Resumo financeiro ──────────────────────────────────────────────

function ResumoFinanceiro({ dados, carregando }) {
  const totalVendas = dados?.vendedores?.reduce((s, v) => s + v.totalVendas, 0) ?? 0;
  const totalComissoes = dados?.vendedores?.reduce((s, v) => s + v.totalComissoes, 0) ?? 0;
  const totalFechamentos = dados?.total ?? 0;

  const cards = [
    { label: "VENDAS FECHADAS", valor: carregando ? null : String(totalFechamentos), Icon: CheckCircle2 },
    { label: "TOTAL EM VENDAS", valor: carregando ? null : money(totalVendas), Icon: TrendingUp },
    { label: "COMISSÕES A PAGAR", valor: carregando ? null : money(totalComissoes), Icon: Wallet },
  ];

  return (
    <div className="vx-grid vx-g3" style={{ marginBottom: 24 }}>
      {cards.map((c) => (
        <div key={c.label} className="vx-glass-panel vx-tile">
          <div className="vx-tile-top">
            <span>{c.label}</span>
            <c.Icon size={17} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="vx-tile-val">
            {c.valor != null ? c.valor : <SkeletonLine width="50%" height={27} />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SEÇÃO 2: Remuneração dos profissionais ──────────────────────────────────

function RemuneracaoResumo({ emp, campanhas, onAbrir, onAbrirCampanhas }) {
  const defaults = emp.comissoes || {};
  const tarefasConfiguradas = ORDEM_ACOES.filter((k) => defaults[k] != null && Number(defaults[k]) > 0);
  const temConfig = tarefasConfiguradas.length > 0;
  const campanhasCustom = campanhas.filter((c) => {
    const temTarefas = Object.keys(c.tarefas || {}).length > 0;
    return temTarefas && !tarefasIguais(c.tarefas, defaults);
  });

  return (
    <section className="vx-card" style={{ padding: 22, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Remuneração dos profissionais</h2>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 0" }}>Configure uma vez e aplique às campanhas compatíveis.</p>
        </div>
        <span className="vx-chip" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Check size={12} /> Tabela padrão
        </span>
      </div>

      {temConfig ? (
        <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <Settings2 size={15} color="var(--muted)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Modelo de remuneração</div>
              <div className="vx-mut" style={{ fontSize: 12 }}>Tabela padrão da empresa</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <CircleDollarSign size={15} color="var(--muted)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Tarefas remuneradas</div>
              <div className="vx-mut" style={{ fontSize: 12 }}>
                {tarefasConfiguradas.map((k) => ACOES[k]?.nome || k).join(", ")}
              </div>
            </div>
            <span className="vx-chip" style={{ fontSize: 11 }}>{tarefasConfiguradas.length} tipo{tarefasConfiguradas.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))", gap: 8 }}>
            {tarefasConfiguradas.map((k) => (
              <div key={k} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div className="vx-mut" style={{ fontSize: 11, marginBottom: 4 }}>{ACOES[k]?.nome || k}</div>
                <div className="vx-mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{money(defaults[k])}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 12, marginBottom: 18 }}>
          <CircleDollarSign size={24} color="var(--muted)" style={{ marginBottom: 6 }} />
          <div className="vx-disp" style={{ fontSize: 14 }}>Nenhuma remuneração configurada</div>
          <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>Defina os valores que os profissionais recebem por resultado.</div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="vx-btn vx-btn-primary" style={{ display: "flex", alignItems: "center", gap: 7 }} onClick={onAbrir}>
          <Settings2 size={14} />
          {temConfig ? "Ajustar remuneração" : "Configurar remuneração"}
        </button>
        {campanhasCustom.length > 0 && (
          <button className="vx-btn vx-btn-sm" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12 }} onClick={onAbrirCampanhas}>
            {campanhasCustom.length} campanha{campanhasCustom.length !== 1 ? "s" : ""} com configuração própria
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </section>
  );
}

// ── Painel lateral: configuração de remuneração (3 etapas) ──────────────────

function PainelRemuneracao({ emp, db, up, aviso, onFechar }) {
  const defaults = emp.comissoes || {};
  const campanhas = useMemo(
    () => (db.campaigns || []).filter((c) => c.companyId === emp.id),
    [db.campaigns, emp.id],
  );

  // Identifica tarefas usadas nas campanhas para pré-seleção
  const tarefasUsadas = useMemo(() => {
    const usadas = new Set();
    for (const c of campanhas) {
      const t = c.tarefas || {};
      for (const k of Object.keys(t)) if (Number(t[k]) > 0) usadas.add(k);
    }
    for (const k of Object.keys(defaults)) if (Number(defaults[k]) > 0) usadas.add(k);
    return usadas;
  }, [campanhas, defaults]);

  const [etapa, setEtapa] = useState(1);
  const [selecionadas, setSelecionadas] = useState(() => {
    const ini = new Set();
    for (const k of ORDEM_ACOES) {
      if (tarefasUsadas.has(k) || (defaults[k] != null && Number(defaults[k]) > 0)) ini.add(k);
    }
    return ini;
  });
  const [modo, setModo] = useState("inteligente");
  const [tabela, setTabela] = useState(() => mapaParaStrings(defaults));
  const [vendaModo, setVendaModo] = useState("fixo");

  // Dados para sugestão inteligente
  const [margem, setMargem] = useState("30");
  const [parcela, setParcela] = useState(20);
  const [conversao, setConversao] = useState("20");
  const [ticket, setTicket] = useState("");
  const [sugestaoAplicada, setSugestaoAplicada] = useState(false);

  // Buscar dados reais para sugestão
  const dadosReais = useMemo(() => {
    const leads = (db.leads || []).filter((l) =>
      l.companyId === emp.id && ["ganho", "fechado"].includes(l.etapa) && Number(l.valorVenda) > 0
    );
    const totalVendas = leads.reduce((s, l) => s + Number(l.valorVenda || 0), 0);
    const qtdVendas = leads.length;
    const ticketMedio = qtdVendas > 0 ? totalVendas / qtdVendas : 0;
    return { ticketMedio, qtdVendas, totalVendas };
  }, [db.leads, emp.id]);

  useEffect(() => {
    if (dadosReais.ticketMedio > 0 && !ticket) {
      setTicket(formatarBRL(dadosReais.ticketMedio));
    }
  }, [dadosReais.ticketMedio]);

  useEffect(() => {
    const fechar = (e) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [onFechar]);

  const toggleTarefa = (k) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  // Calcular sugestão inteligente
  const sugestao = useMemo(() => {
    const tk = parseNumPt(ticket);
    const mg = parseNumPt(margem) / 100;
    const cv = parseNumPt(conversao) / 100;
    const pr = parcela / 100;
    if (!tk || !cv) return null;

    const tetoVenda = tk * mg * pr;
    const refReuniao = tetoVenda * cv;

    const pesos = {
      contato: 0.08, lead_qualificado: 0.12, follow: 0.06,
      agendamento: 0.5, realizada: 0.9, visita: 0.4, ligacao: 0.18, venda: 6,
    };

    const valores = {};
    for (const k of ORDEM_ACOES) {
      if (!selecionadas.has(k)) continue;
      if (k === "venda") {
        valores[k] = Math.round(tetoVenda * 100) / 100;
      } else {
        valores[k] = Math.round(refReuniao * (pesos[k] || 0.3) * 100) / 100;
      }
    }

    return { valores, tetoVenda, refReuniao, premissas: { ticket: tk, margem: mg, conversao: cv, parcela: pr } };
  }, [ticket, margem, conversao, parcela, selecionadas]);

  const aplicarSugestao = () => {
    if (!sugestao) return;
    const nova = { ...mapaParaStrings({}) };
    for (const [k, v] of Object.entries(sugestao.valores)) {
      nova[k] = formatarBRL(v);
    }
    setTabela(nova);
    setSugestaoAplicada(true);
  };

  const salvar = () => {
    const limpo = {};
    for (const k of ORDEM_ACOES) {
      if (!selecionadas.has(k)) continue;
      const s = String(tabela[k] ?? "").trim();
      if (s === "") continue;
      const num = parseBRL(s);
      if (num >= 0) limpo[k] = num;
    }
    apiPatch(`/companies/${emp.id}`, { comissoes: limpo });
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, comissoes: limpo } : c) }));
    aviso("Remuneração salva com sucesso.");
    onFechar();
  };

  const campanhasAfetadas = campanhas.filter((c) => tarefasIguais(c.tarefas, defaults) && !(Number(c.percentualComissao) > 0));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onFechar} style={{ position: "absolute", inset: 0, background: "rgba(10,15,25,.45)" }} />
      <aside
        className="vx-fade" role="dialog" aria-label="Configurar remuneração"
        style={{
          position: "relative", width: "min(520px, 100%)", height: "100%", background: "var(--surface)",
          boxShadow: "-10px 0 36px rgba(0,0,0,.22)", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "20px 22px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
          <div style={{ minWidth: 0 }}>
            <div className="vx-eyebrow">Remuneração</div>
            <h2 className="vx-disp" style={{ fontSize: 17, margin: "3px 0 2px" }}>Configurar remuneração</h2>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: 0 }}>Defina quanto deseja pagar por cada resultado comercial.</p>
          </div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onFechar} title="Fechar"><X size={16} /></button>
        </div>

        {/* Steps indicator */}
        <div style={{ display: "flex", gap: 0, padding: "0 22px", borderBottom: "1px solid var(--border)" }}>
          {[
            [1, "Tarefas"],
            [2, "Valores"],
            [3, "Revisão"],
          ].map(([n, label]) => (
            <button
              key={n} type="button"
              onClick={() => { if (n < etapa) setEtapa(n); }}
              style={{
                flex: 1, padding: "12px 8px", border: "none", background: "transparent", cursor: n < etapa ? "pointer" : "default",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: etapa === n ? "var(--brand)" : etapa > n ? "var(--ink)" : "var(--muted)",
                borderBottom: `2px solid ${etapa === n ? "var(--brand)" : "transparent"}`, transition: "all .16s",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 700, marginRight: 6, background: etapa === n ? "var(--brand)" : etapa > n ? "var(--brand-50)" : "var(--surface-2)", color: etapa === n ? "#fff" : etapa > n ? "var(--brand)" : "var(--muted)" }}>
                {etapa > n ? <Check size={12} /> : n}
              </span>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {/* ETAPA 1 — Tarefas */}
          {etapa === 1 && (
            <div className="vx-fade">
              <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 16px" }}>Selecione as ações que você deseja remunerar.</p>
              <div style={{ display: "grid", gap: 8 }}>
                {ORDEM_ACOES.map((k) => {
                  const on = selecionadas.has(k);
                  const usada = tarefasUsadas.has(k);
                  return (
                    <button
                      key={k} type="button" onClick={() => toggleTarefa(k)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12,
                        border: `1.5px solid ${on ? "var(--brand)" : "var(--border)"}`,
                        background: on ? "var(--brand-50)" : "var(--surface)",
                        cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all .16s",
                      }}
                    >
                      <span style={{
                        width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? "var(--brand)" : "var(--border-strong, var(--border))"}`,
                        background: on ? "var(--brand)" : "transparent",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .16s",
                      }}>
                        {on && <Check size={12} color="#fff" strokeWidth={3} />}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: on ? "var(--brand)" : "var(--ink)" }}>{ACOES[k]?.nome || k}</div>
                        {usada && <div className="vx-mut" style={{ fontSize: 11 }}>Utilizada em campanhas ativas</div>}
                      </div>
                      {defaults[k] != null && Number(defaults[k]) > 0 && (
                        <span className="vx-mono" style={{ fontSize: 12, color: "var(--muted)" }}>{money(defaults[k])}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ETAPA 2 — Valores */}
          {etapa === 2 && (
            <div className="vx-fade">
              {/* Seleção de modo */}
              <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
                {[
                  ["inteligente", Sparkles, "Sugestão inteligente", "A RYCS sugere valores com base nos dados do seu negócio."],
                  ["manual", SlidersHorizontal, "Configuração manual", "Defina os valores de remuneração individualmente."],
                ].map(([val, Icon, titulo, desc]) => {
                  const on = modo === val;
                  return (
                    <button
                      key={val} type="button" onClick={() => { setModo(val); setSugestaoAplicada(false); }}
                      style={{
                        textAlign: "left", padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                        border: `1.5px solid ${on ? (val === "inteligente" ? "var(--brand)" : "var(--brand)") : "var(--border)"}`,
                        background: on ? "var(--brand-50)" : "var(--surface)", transition: "all .16s", fontFamily: "inherit",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon size={16} color={on ? "var(--brand)" : "var(--muted)"} />
                        <b style={{ fontSize: 13.5, color: on ? "var(--brand)" : "var(--ink)" }}>{titulo}</b>
                        {val === "inteligente" && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "var(--brand)", color: "#fff" }}>Recomendado</span>
                        )}
                      </div>
                      <div className="vx-mut" style={{ fontSize: 12, marginTop: 4, marginLeft: 24 }}>{desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Modo inteligente */}
              {modo === "inteligente" && (
                <div>
                  <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
                    <label>
                      <div className="vx-label">Ticket médio (R$) {dadosReais.ticketMedio > 0 && <span style={{ fontWeight: 400, color: "var(--brand)" }}>· preenchido automaticamente</span>}</div>
                      <InputMoeda value={ticket} onChange={setTicket} />
                    </label>
                    <label>
                      <div className="vx-label">Margem bruta (%)</div>
                      <input className="vx-input vx-mono" inputMode="decimal" value={margem} placeholder="30"
                        onChange={(e) => setMargem(e.target.value.replace(/[^\d.,]/g, ""))} />
                    </label>
                    <label>
                      <div className="vx-label">Conversão reunião → venda (%)</div>
                      <input className="vx-input vx-mono" inputMode="decimal" value={conversao} placeholder="20"
                        onChange={(e) => setConversao(e.target.value.replace(/[^\d.,]/g, ""))} />
                    </label>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span className="vx-label" style={{ margin: 0 }}>Parcela da margem para remuneração</span>
                        <b className="vx-mono" style={{ fontSize: 13, color: "var(--brand)" }}>{parcela}%</b>
                      </div>
                      <input type="range" min={5} max={50} step={1} value={parcela}
                        onChange={(e) => setParcela(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--brand)", cursor: "pointer" }} />
                    </div>
                  </div>

                  {sugestao && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface-2)", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <Sparkles size={15} color="var(--brand)" />
                        <b style={{ fontSize: 13.5, color: "var(--ink)" }}>Sugestão de remuneração</b>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                        <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
                          <div className="vx-mut" style={{ fontSize: 11, marginBottom: 4 }}>Teto estimado por venda</div>
                          <div className="vx-mono" style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{money(sugestao.tetoVenda)}</div>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
                          <div className="vx-mut" style={{ fontSize: 11, marginBottom: 4 }}>Referência por reunião</div>
                          <div className="vx-mono" style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{money(sugestao.refReuniao)}</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                        {[...selecionadas].filter((k) => sugestao.valores[k] != null).map((k) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                            <span>{ACOES[k]?.nome || k}</span>
                            <b className="vx-mono" style={{ color: "var(--brand)" }}>{money(sugestao.valores[k])}</b>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
                        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                        Valores estimados com base nas premissas informadas. Você pode editar cada valor na próxima etapa.
                      </div>
                      <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => { aplicarSugestao(); setEtapa(3); }}>
                        Aplicar sugestão e revisar
                      </button>
                    </div>
                  )}

                  {!sugestao && (
                    <div style={{ padding: 16, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 12, color: "var(--muted)", fontSize: 12.5 }}>
                      <Calculator size={20} style={{ marginBottom: 6, opacity: 0.5 }} />
                      <div>Preencha o ticket médio e a conversão para ver a sugestão.</div>
                    </div>
                  )}
                </div>
              )}

              {/* Modo manual */}
              {modo === "manual" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 12 }}>
                    {[...selecionadas].filter((k) => k !== "venda").map((k) => (
                      <label key={k}>
                        <div className="vx-label">{ACOES[k]?.nome || k}</div>
                        <InputMoeda value={tabela[k] ?? ""} onChange={(val) => setTabela((p) => ({ ...p, [k]: val }))} />
                      </label>
                    ))}
                  </div>
                  {selecionadas.has("venda") && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface-2)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Banknote size={15} color="var(--brand)" />
                          <b style={{ fontSize: 13.5 }}>{ACOES.venda?.nome || "Venda fechada"}</b>
                        </div>
                        <Segmentado
                          value={vendaModo} onChange={setVendaModo}
                          options={[
                            { value: "fixo", label: "Valor fixo", icon: <CircleDollarSign size={13} /> },
                            { value: "percentual", label: "Percentual", icon: <Percent size={13} /> },
                          ]}
                        />
                      </div>
                      {vendaModo === "fixo" ? (
                        <div style={{ maxWidth: 240 }}>
                          <InputMoeda value={tabela.venda ?? ""} onChange={(val) => setTabela((p) => ({ ...p, venda: val }))} />
                          <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 6 }}>Valor fixo pago por cada venda registrada.</div>
                        </div>
                      ) : (
                        <div style={{ maxWidth: 240 }}>
                          <div className="vx-mut" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                            O percentual por venda é definido por campanha. Na tabela padrão, use valor fixo.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selecionadas.size === 0 && (
                    <div style={{ padding: 16, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 12, color: "var(--muted)", fontSize: 12.5 }}>
                      Volte à etapa anterior e selecione ao menos uma tarefa.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3 — Revisão */}
          {etapa === 3 && (
            <div className="vx-fade">
              <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 18px" }}>Revise os valores antes de salvar.</p>

              <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
                <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <CircleDollarSign size={15} color="var(--brand)" />
                  <b style={{ fontSize: 13.5 }}>Valores definidos</b>
                </div>
                <div style={{ padding: "4px 0" }}>
                  {[...selecionadas].map((k) => {
                    const val = tabela[k];
                    const num = parseBRL(val);
                    return (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 13 }}>{ACOES[k]?.nome || k}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <b className="vx-mono" style={{ fontSize: 13, color: num > 0 ? "var(--brand)" : "var(--muted)" }}>
                            {num > 0 ? money(num) : "—"}
                          </b>
                          <InputMoeda
                            value={val ?? ""}
                            onChange={(v) => setTabela((p) => ({ ...p, [k]: v }))}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {selecionadas.size === 0 && (
                    <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
                      Nenhuma tarefa selecionada.
                    </div>
                  )}
                </div>
              </div>

              {campanhasAfetadas.length > 0 && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.55, padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    <b>{campanhasAfetadas.length} campanha{campanhasAfetadas.length !== 1 ? "s" : ""}</b> utiliza{campanhasAfetadas.length === 1 ? "" : "m"} a tabela padrão e será{campanhasAfetadas.length === 1 ? "" : "ão"} afetada{campanhasAfetadas.length === 1 ? "" : "s"}.
                  </span>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                As alterações valem para novas tarefas. Pagamentos já registrados e vendas já fechadas não são recalculados.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid var(--border)", position: "sticky", bottom: 0, background: "var(--surface)" }}>
          {etapa > 1 ? (
            <button className="vx-btn" style={{ flex: 1 }} onClick={() => setEtapa(etapa - 1)}>Voltar</button>
          ) : (
            <button className="vx-btn" style={{ flex: 1 }} onClick={onFechar}>Cancelar</button>
          )}
          {etapa < 3 ? (
            <button
              className="vx-btn vx-btn-primary" style={{ flex: 1 }}
              disabled={etapa === 1 && selecionadas.size === 0}
              onClick={() => {
                if (etapa === 2 && modo === "inteligente" && sugestao && !sugestaoAplicada) {
                  aplicarSugestao();
                }
                setEtapa(etapa + 1);
              }}
            >
              Continuar
            </button>
          ) : (
            <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} disabled={selecionadas.size === 0} onClick={salvar}>
              Salvar remuneração
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Painel lateral: campanhas com configuração própria ───────────────────────

function PainelCampanhasCustom({ campanhas, defaults, onFechar, onEditar }) {
  useEffect(() => {
    const fechar = (e) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [onFechar]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onFechar} style={{ position: "absolute", inset: 0, background: "rgba(10,15,25,.45)" }} />
      <aside
        className="vx-fade" role="dialog" aria-label="Campanhas com configuração própria"
        style={{
          position: "relative", width: "min(460px, 100%)", height: "100%", background: "var(--surface)",
          boxShadow: "-10px 0 36px rgba(0,0,0,.22)", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "20px 22px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="vx-eyebrow">Comissões por campanha</div>
            <h2 className="vx-disp" style={{ fontSize: 17, margin: "3px 0 2px" }}>Configurações personalizadas</h2>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: 0 }}>Campanhas que não utilizam a tabela padrão.</p>
          </div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onFechar} title="Fechar"><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {campanhas.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center" }}>
              <Megaphone size={24} color="var(--muted)" style={{ marginBottom: 8 }} />
              <div className="vx-disp" style={{ fontSize: 14 }}>Todas as campanhas usam a tabela padrão</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {campanhas.map((c) => {
                const tarefas = c.tarefas || {};
                const pct = Number(c.percentualComissao) || 0;
                return (
                  <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                      <div>
                        <b style={{ fontSize: 14 }}>{c.titulo}</b>
                        <span className={`vx-campaign-status is-${c.status}`} style={{ fontSize: 11, marginLeft: 8 }}>{c.status}</span>
                      </div>
                      <button className="vx-btn vx-btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }} onClick={() => onEditar(c)}>
                        <Settings2 size={13} /> Editar
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 120px), 1fr))", gap: 6 }}>
                      {Object.entries(tarefas).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
                        <div key={k} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, background: "var(--surface-2)" }}>
                          <span className="vx-mut">{ACOES[k]?.nome || k}</span>
                          <div className="vx-mono" style={{ fontWeight: 600 }}>{money(v)}</div>
                        </div>
                      ))}
                      {pct > 0 && (
                        <div style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, background: "var(--surface-2)" }}>
                          <span className="vx-mut">Venda (%)</span>
                          <div className="vx-mono" style={{ fontWeight: 600 }}>{pct}%</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Painel lateral: edição de comissões de uma campanha ─────────────────────

function PainelComissaoCampanha({ campanha, defaults, onFechar, onSalvar }) {
  const temPropria = Object.keys(campanha.tarefas || {}).length > 0;
  const pctInicial = Number(campanha.percentualComissao) || 0;
  const ehPadraoInicial = tarefasIguais(campanha.tarefas, defaults) && pctInicial <= 0;

  const [modo, setModo] = useState(ehPadraoInicial ? "padrao" : "custom");
  const [tabela, setTabela] = useState(() => mapaParaStrings(temPropria ? campanha.tarefas : defaults));
  const [vendaModo, setVendaModo] = useState(pctInicial > 0 ? "percentual" : "fixo");
  const [pct, setPct] = useState(pctInicial > 0 ? String(pctInicial).replace(".", ",") : "");

  useEffect(() => {
    const fechar = (e) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [onFechar]);

  const salvar = () => {
    if (modo === "padrao") {
      onSalvar(campanha, { tarefas: { ...defaults }, percentualComissao: 0 });
      return;
    }
    const limpo = stringsParaMapa(tabela, ACOES_SEM_VENDA);
    let percentual = 0;
    if (vendaModo === "fixo") {
      const s = String(tabela.venda ?? "").trim();
      if (s !== "") { const num = parseBRL(s); if (num >= 0) limpo.venda = num; }
    } else {
      percentual = Math.max(0, Math.min(100, parseNumPt(pct)));
    }
    onSalvar(campanha, { tarefas: limpo, percentualComissao: percentual });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 130, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onFechar} style={{ position: "absolute", inset: 0, background: "rgba(10,15,25,.45)" }} />
      <aside
        className="vx-fade" role="dialog" aria-label={`Comissões da campanha ${campanha.titulo}`}
        style={{
          position: "relative", width: "min(460px, 100%)", height: "100%", background: "var(--surface)",
          boxShadow: "-10px 0 36px rgba(0,0,0,.22)", display: "flex", flexDirection: "column", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "20px 22px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
          <div style={{ minWidth: 0 }}>
            <div className="vx-eyebrow">Comissões por campanha</div>
            <h2 className="vx-disp" style={{ fontSize: 17, margin: "3px 0 2px" }}>{campanha.titulo}</h2>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: 0 }}>Configure os valores pagos aos profissionais desta campanha.</p>
          </div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onFechar} title="Fechar"><X size={16} /></button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              ["padrao", "Utilizar tabela padrão", "Esta campanha usa os valores definidos pela empresa."],
              ["custom", "Personalizar valores", "Defina pagamentos específicos para esta campanha."],
            ].map(([val, titulo, desc]) => {
              const on = modo === val;
              return (
                <button
                  key={val} type="button" onClick={() => setModo(val)}
                  style={{
                    textAlign: "left", padding: "13px 15px", borderRadius: 12, cursor: "pointer",
                    border: `1.5px solid ${on ? "var(--brand)" : "var(--border)"}`,
                    background: on ? "var(--brand-50)" : "var(--surface)", transition: "all .16s", fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${on ? "var(--brand)" : "var(--border-strong, var(--border))"}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {on && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand)" }} />}
                    </span>
                    <b style={{ fontSize: 13.5, color: on ? "var(--brand)" : "var(--ink)" }}>{titulo}</b>
                  </div>
                  <div className="vx-mut" style={{ fontSize: 12, marginTop: 4, marginLeft: 24 }}>{desc}</div>
                </button>
              );
            })}
          </div>

          {modo === "padrao" ? (
            <div>
              <div className="vx-mut" style={{ fontSize: 12, marginBottom: 10, display: "flex", gap: 7, alignItems: "flex-start", lineHeight: 1.5 }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                Valores herdados da tabela padrão da empresa.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {ORDEM_ACOES.map((k) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13 }}>{ACOES[k]?.nome || k}</span>
                    <b className="vx-mono" style={{ fontSize: 13 }}>{defaults?.[k] != null ? money(defaults[k]) : "—"}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 12 }}>
                {ACOES_SEM_VENDA.map((k) => (
                  <label key={k}>
                    <div className="vx-label">{ACOES[k]?.nome || k}</div>
                    <InputMoeda value={tabela[k] ?? ""} onChange={(val) => setTabela((p) => ({ ...p, [k]: val }))} />
                  </label>
                ))}
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Banknote size={15} color="var(--brand)" />
                    <b style={{ fontSize: 13.5 }}>{ACOES.venda?.nome || "Venda fechada"}</b>
                  </div>
                  <Segmentado
                    value={vendaModo} onChange={setVendaModo}
                    options={[
                      { value: "fixo", label: "Valor fixo", icon: <CircleDollarSign size={13} /> },
                      { value: "percentual", label: "Percentual", icon: <Percent size={13} /> },
                    ]}
                  />
                </div>
                {vendaModo === "fixo" ? (
                  <div style={{ maxWidth: 240 }}>
                    <InputMoeda value={tabela.venda ?? ""} onChange={(val) => setTabela((p) => ({ ...p, venda: val }))} />
                    <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 6 }}>Valor fixo pago por cada venda registrada.</div>
                  </div>
                ) : (
                  <div style={{ maxWidth: 240 }}>
                    <div style={{ position: "relative" }}>
                      <input
                        className="vx-input vx-mono" inputMode="decimal"
                        style={{ paddingRight: 30 }}
                        value={pct} placeholder="0"
                        onChange={(e) => setPct(e.target.value.replace(/[^\d.,]/g, ""))}
                      />
                      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: "var(--text-2)", pointerEvents: "none" }}>%</span>
                    </div>
                    <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
                      Percentual sobre o valor de cada venda fechada no funil.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.55 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            As alterações valem para novas tarefas. Pagamentos já registrados não são recalculados.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid var(--border)", position: "sticky", bottom: 0, background: "var(--surface)" }}>
          <button className="vx-btn" style={{ flex: 1 }} onClick={onFechar}>Cancelar</button>
          <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} onClick={salvar}>Salvar configuração</button>
        </div>
      </aside>
    </div>
  );
}

// ── SEÇÃO 3: Últimos fechamentos ────────────────────────────────────────────

function UltimosFechamentos({ dados, carregando }) {
  const [mostrarTodos, setMostrarTodos] = useState(false);

  if (carregando) {
    return (
      <section className="vx-card" style={{ padding: 22 }}>
        <SkeletonLine width="40%" height={18} />
        <div style={{ marginTop: 12 }}><SkeletonLine width="100%" height={14} /></div>
        <div style={{ marginTop: 8 }}><SkeletonLine width="100%" height={14} /></div>
        <div style={{ marginTop: 8 }}><SkeletonLine width="80%" height={14} /></div>
      </section>
    );
  }

  const vendedores = dados?.vendedores || [];
  const todosLeads = vendedores.flatMap((v) =>
    v.leads.map((l) => ({ ...l, sellerNome: v.nome }))
  ).sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));

  const visiveis = mostrarTodos ? todosLeads : todosLeads.slice(0, 5);

  return (
    <section className="vx-card" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Últimos fechamentos</h2>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 0" }}>Vendas registradas e comissões geradas.</p>
        </div>
        {todosLeads.length > 5 && (
          <button
            className="vx-btn vx-btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}
            onClick={() => setMostrarTodos(!mostrarTodos)}
          >
            {mostrarTodos ? "Mostrar menos" : `Ver todos (${todosLeads.length})`}
            <ChevronRight size={14} style={{ transform: mostrarTodos ? "rotate(90deg)" : "none", transition: "transform .16s" }} />
          </button>
        )}
      </div>

      {todosLeads.length === 0 ? (
        <div style={{ padding: 28, textAlign: "center" }}>
          <ReceiptText size={26} color="var(--muted)" style={{ marginBottom: 8 }} />
          <div className="vx-disp" style={{ fontSize: 15 }}>Nenhum fechamento registrado</div>
          <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>As vendas confirmadas aparecerão aqui automaticamente.</div>
        </div>
      ) : (
        <div className="vx-table-wrap">
          <table className="vx-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Profissional</th>
                <th>Campanha</th>
                <th style={{ textAlign: "right" }}>Venda</th>
                <th style={{ textAlign: "right" }}>Comissão</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.sellerNome}</td>
                  <td>{l.campanhaTitulo || "—"}</td>
                  <td className="vx-mono" style={{ textAlign: "right" }}>{money(l.valorVenda)}</td>
                  <td className="vx-mono" style={{ textAlign: "right", color: "var(--brand)" }}>{money(l.comissaoCalculada)}</td>
                  <td>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "2px 8px",
                      borderRadius: 20, background: l.comissaoCalculada > 0 ? "var(--brand-50)" : "var(--surface-2)",
                      color: l.comissaoCalculada > 0 ? "var(--brand)" : "var(--muted)",
                    }}>
                      {l.comissaoCalculada > 0 ? "Comissão calculada" : "Aguardando"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-2)", fontSize: 11.5 }}>{dataCurta(l.atualizadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Orçamento de campanhas (mantido inalterado) ─────────────────────────────

function OrcamentoCampanhas({ campanhas }) {
  const ativas = campanhas.filter((c) => c.status === "ativa" || c.status === "rascunho");
  const totalOrcado = ativas.reduce((acc, c) => acc + Number(c.orcamento || 0), 0);

  return (
    <div>
      <div className="vx-grid vx-g4" style={{ marginBottom: 18 }}>
        {[
          ["Campanhas ativas", campanhas.filter((c) => c.status === "ativa").length.toLocaleString("pt-BR"), Megaphone],
          ["Total orçado", money(totalOrcado), Wallet],
          ["Campanhas rascunho", campanhas.filter((c) => c.status === "rascunho").length.toLocaleString("pt-BR"), FileText],
          ["Campanhas encerradas", campanhas.filter((c) => c.status === "encerrada" || c.status === "pausada").length.toLocaleString("pt-BR"), Archive],
        ].map(([label, val, Icon]) => (
          <div key={label} className="vx-glass-panel vx-tile">
            <div className="vx-tile-top">
              <span>{label}</span>
              <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
            </div>
            <div className="vx-tile-val">{val}</div>
          </div>
        ))}
      </div>

      {campanhas.length === 0 ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <Wallet size={26} color="var(--muted)" style={{ marginBottom: 8 }} />
          <div className="vx-disp" style={{ fontSize: 15 }}>Nenhuma campanha criada</div>
          <div className="vx-mut" style={{ fontSize: 13 }}>Crie uma campanha para ver os orçamentos aqui.</div>
        </div>
      ) : (
        <div className="vx-table-wrap">
          <table className="vx-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Orçamento</th>
                <th>Candidaturas</th>
                <th>Região</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.titulo}</td>
                  <td><span className={`vx-campaign-status is-${c.status}`} style={{ fontSize: 11 }}>{c.status}</span></td>
                  <td className="vx-mono" style={{ textAlign: "right" }}>{c.orcamento > 0 ? money(c.orcamento) : <span className="vx-mut">Sem limite</span>}</td>
                  <td style={{ fontSize: 12, color: c.candidaturasAbertas === false ? "var(--muted)" : "var(--brand)" }}>{c.candidaturasAbertas === false ? "Encerradas" : "Abertas"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-2)" }}>{c.regiao || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="vx-chart-source" style={{ marginTop: 10 }}>
        Orçamentos cadastrados nas campanhas. Consumo real disponível em Insights → Financeiro.
      </div>
    </div>
  );
}

// ── Página unificada de Comissões ───────────────────────────────────────────

function ComissoesUnificada({ emp, db, up, aviso }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [painelCampanhas, setPainelCampanhas] = useState(false);
  const [painelCampanha, setPainelCampanha] = useState(null);

  const campanhas = useMemo(
    () => (db.campaigns || []).filter((c) => c.companyId === emp.id),
    [db.campaigns, emp.id],
  );

  const defaults = emp.comissoes || {};
  const campanhasCustom = useMemo(
    () => campanhas.filter((c) => {
      const temTarefas = Object.keys(c.tarefas || {}).length > 0;
      return (temTarefas && !tarefasIguais(c.tarefas, defaults)) || Number(c.percentualComissao) > 0;
    }),
    [campanhas, defaults],
  );

  const carregarDados = useCallback(() => {
    setCarregando(true);
    api("/leads/comissoes")
      .then((r) => { setDados(r); setCarregando(false); })
      .catch(() => setCarregando(false));
  }, [emp.id]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const salvarCampanha = (campanha, patch) => {
    apiPatch(`/campaigns/${campanha.id}`, patch);
    up((d) => ({ campaigns: d.campaigns.map((c) => c.id === campanha.id ? { ...c, ...patch } : c) }));
    aviso("Comissões da campanha salvas.");
    setPainelCampanha(null);
  };

  return (
    <div>
      {/* Indicadores financeiros */}
      <ResumoFinanceiro dados={dados} carregando={carregando} />

      {/* Remuneração dos profissionais */}
      <RemuneracaoResumo
        emp={emp}
        campanhas={campanhas}
        onAbrir={() => setPainelAberto(true)}
        onAbrirCampanhas={() => setPainelCampanhas(true)}
      />

      {/* Últimos fechamentos */}
      <UltimosFechamentos dados={dados} carregando={carregando} />

      {/* Painéis laterais */}
      {painelAberto && (
        <PainelRemuneracao
          emp={emp} db={db} up={up} aviso={aviso}
          onFechar={() => setPainelAberto(false)}
        />
      )}

      {painelCampanhas && !painelCampanha && (
        <PainelCampanhasCustom
          campanhas={campanhasCustom}
          defaults={defaults}
          onFechar={() => setPainelCampanhas(false)}
          onEditar={(c) => setPainelCampanha(c)}
        />
      )}

      {painelCampanha && (
        <PainelComissaoCampanha
          campanha={painelCampanha}
          defaults={defaults}
          onFechar={() => setPainelCampanha(null)}
          onSalvar={salvarCampanha}
        />
      )}
    </div>
  );
}

// ── Export principal ────────────────────────────────────────────────────────

export default function ValoresEmpresa({ emp, db, up, aviso, onAdicionarSaldo, escopo = "orcamento" }) {
  const ehComissoes = escopo === "comissoes";
  const campanhas = useMemo(
    () => (db.campaigns || []).filter((c) => c.companyId === emp.id),
    [db.campaigns, emp.id],
  );

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Financeiro comercial</div>
          <h1 className="vx-disp">{ehComissoes ? "Comissões" : "Pagamento dos Profissionais"}</h1>
          <p>{ehComissoes
            ? "Acompanhe resultados e gerencie a remuneração dos profissionais."
            : "Orçamentos das campanhas para o pagamento dos profissionais."}</p>
        </div>
        {!ehComissoes && (
          <button className="vx-btn vx-btn-primary" style={{ flexShrink: 0, gap: 7 }} onClick={() => onAdicionarSaldo?.()}>
            <Wallet size={15} /> Adicionar Saldo
          </button>
        )}
      </div>

      {ehComissoes
        ? <ComissoesUnificada emp={emp} db={db} up={up} aviso={aviso} />
        : <OrcamentoCampanhas campanhas={campanhas} />
      }
    </div>
  );
}
