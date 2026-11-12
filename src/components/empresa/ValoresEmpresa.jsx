import { useEffect, useMemo, useState } from "react";
import { Archive, Banknote, Calculator, Check, ChevronRight, CircleDollarSign, FileText, Info, Megaphone, Percent, Settings2, TrendingUp, User, Wallet, X } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";


function formatarBRL(valor) {
  if (!valor && valor !== 0) return "";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(str) {
  if (!str) return 0;
  return Number(String(str).replace(/\./g, "").replace(",", ".")) || 0;
}

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

function Comissoes({ emp }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api("/leads/comissoes").then((r) => { setDados(r); setCarregando(false); }).catch(() => setCarregando(false));
  }, [emp.id]);

  if (carregando) return <div className="vx-mut" style={{ padding: 20 }}>Carregando…</div>;
  if (!dados) return <div className="vx-mut" style={{ padding: 20 }}>Não foi possível carregar.</div>;

  const { vendedores = [], total } = dados;
  const totalVendas = vendedores.reduce((s, v) => s + v.totalVendas, 0);
  const totalComissoes = vendedores.reduce((s, v) => s + v.totalComissoes, 0);

  return (
    <div>
      <div className="vx-grid vx-g3" style={{ marginBottom: 18 }}>
        {[
          ["Fechamentos", total, TrendingUp],
          ["Total em vendas", money(totalVendas), CircleDollarSign],
          ["Comissões a pagar", money(totalComissoes), Wallet],
        ].map(([label, val, Icon]) => (
          <div key={label} className="vx-glass-panel vx-tile">
            <div className="vx-tile-top"><span>{label}</span><Icon size={17} strokeWidth={1.7} aria-hidden="true" /></div>
            <div className="vx-tile-val">{val}</div>
          </div>
        ))}
      </div>

      {vendedores.length === 0 ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <CircleDollarSign size={26} color="var(--muted)" style={{ marginBottom: 8 }} />
          <div className="vx-disp" style={{ fontSize: 15 }}>Sem fechamentos registrados</div>
          <div className="vx-mut" style={{ fontSize: 13 }}>Mova um lead para "Fechado" com o valor da venda para calcular comissões.</div>
        </div>
      ) : (
        <div className="vx-grid">
          {vendedores.map((v) => (
            <div key={v.sellerId} className="vx-card" style={{ padding: 16 }}>
              <div className="vx-row" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={16} color="var(--brand)" />
                  <b>{v.nome}</b>
                </div>
                <span className="vx-chip">{v.fechamentos} fechamento{v.fechamentos !== 1 ? "s" : ""}</span>
              </div>
              <div className="vx-grid vx-g3" style={{ marginBottom: 10 }}>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>Volume de vendas</div><b className="vx-mono">{money(v.totalVendas)}</b></div>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>Comissão total</div><b className="vx-mono" style={{ color: "var(--brand)" }}>{money(v.totalComissoes)}</b></div>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>Taxa média</div><b className="vx-mono">{v.totalVendas > 0 ? (v.totalComissoes / v.totalVendas * 100).toFixed(1) : "—"}%</b></div>
              </div>
              <div className="vx-table-wrap">
                <table className="vx-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Lead</th><th>Campanha</th><th>Venda</th><th>Comissão</th><th>Data</th></tr></thead>
                  <tbody>
                    {v.leads.map((l) => (
                      <tr key={l.id}>
                        <td>{l.nome}</td>
                        <td>{l.campanhaTitulo || "—"}</td>
                        <td className="vx-mono">{money(l.valorVenda)}</td>
                        <td className="vx-mono" style={{ color: "var(--brand)" }}>{money(l.comissaoCalculada)}</td>
                        <td style={{ color: "var(--text-2)", fontSize: 11.5 }}>{dataCurta(l.atualizadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers de comissão ──────────────────────────────────────────────────────
const ACOES_SEM_VENDA = ORDEM_ACOES.filter((k) => k !== "venda");

// Converte o mapa { tipo: número } guardado no backend numa cópia editável de
// strings formatadas (vazio = ação não remunerada, diferente de zero).
const mapaParaStrings = (obj = {}) =>
  Object.fromEntries(ORDEM_ACOES.map((k) => [k, obj?.[k] != null ? formatarBRL(obj[k]) : ""]));

const numeroOuNulo = (s) => {
  const t = String(s ?? "").trim();
  return t === "" ? null : parseBRL(t);
};
const numeroBase = (v) => (v == null ? null : Number(v));

// Duas tabelas de ação pagam igual? (compara só os valores, ignora chaves ausentes = 0)
const tarefasIguais = (a = {}, b = {}) => {
  const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of ks) if (Number(a?.[k] || 0) !== Number(b?.[k] || 0)) return false;
  return true;
};

// Monta o mapa limpo { tipo: número } a partir das strings editadas.
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

// Bloco especial de "Venda fechada": valor fixo ou percentual.
function BlocoVenda({ modo, setModo, valorFixo, setValorFixo, pct, setPct, percentualHabilitado }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface-2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Banknote size={15} color="var(--brand)" />
          <b style={{ fontSize: 13.5 }}>{ACOES.venda?.nome || "Venda fechada"}</b>
        </div>
        <Segmentado
          value={modo} onChange={setModo}
          options={[
            { value: "fixo", label: "Valor fixo", icon: <CircleDollarSign size={13} /> },
            { value: "percentual", label: "Percentual", icon: <Percent size={13} /> },
          ]}
        />
      </div>
      {modo === "fixo" ? (
        <div style={{ maxWidth: 240 }}>
          <InputMoeda value={valorFixo} onChange={setValorFixo} />
          <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>Valor fixo pago por cada venda registrada.</div>
        </div>
      ) : (
        <div style={{ maxWidth: 240 }}>
          <div style={{ position: "relative" }}>
            <input
              className="vx-input vx-mono" inputMode="decimal" disabled={!percentualHabilitado}
              style={{ paddingRight: 30, opacity: percentualHabilitado ? 1 : 0.55 }}
              value={pct} placeholder="0"
              onChange={(e) => setPct(e.target.value.replace(/[^\d.,]/g, ""))}
            />
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: "var(--text-2)", pointerEvents: "none" }}>%</span>
          </div>
          <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
            {percentualHabilitado
              ? "Percentual sobre o valor de cada venda fechada no funil."
              : "O percentual por venda é definido por campanha. Na tabela padrão, use valor fixo."}
          </div>
        </div>
      )}
    </div>
  );
}

function NotaVigencia() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.55 }}>
      <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      As alterações valem para novas tarefas. Pagamentos já registrados e vendas já fechadas não são recalculados.
    </div>
  );
}

// ── Calculadora de comissões (simulação, não persiste nada) ───────────────────
const parseNumPt = (s) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;

function Calculadora() {
  const [ticket, setTicket] = useState("");
  const [margem, setMargem] = useState("30");
  const [conversao, setConversao] = useState("20");
  const [parcela, setParcela] = useState(20);

  const tk = parseNumPt(ticket);
  const mg = parseNumPt(margem) / 100;
  const cv = parseNumPt(conversao) / 100;
  const pr = parcela / 100;
  const temDados = tk > 0;
  const tetoVenda = tk * mg * pr;
  const refReuniao = tetoVenda * cv;

  const campos = [
    { k: "ticket", label: "Ticket médio (R$)", v: ticket, set: setTicket },
    { k: "margem", label: "Margem bruta (%)", v: margem, set: setMargem },
    { k: "conversao", label: "Conversão reunião → venda (%)", v: conversao, set: setConversao },
  ];

  return (
    <section className="vx-card" style={{ padding: 22, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Calculator size={17} color="var(--brand)" />
        <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Calculadora de comissões</h2>
      </div>
      <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 18px" }}>Simule quanto seu negócio pode pagar por resultado.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {campos.map((c) => (
          <label key={c.k}>
            <div className="vx-label">{c.label}</div>
            <input className="vx-input vx-mono" inputMode="decimal" value={c.v}
              onChange={(e) => c.set(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" />
          </label>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span className="vx-label" style={{ margin: 0 }}>Parcela da margem destinada à remuneração</span>
          <b className="vx-mono" style={{ fontSize: 14, color: "var(--brand)" }}>{parcela}%</b>
        </div>
        <input type="range" min={5} max={50} step={1} value={parcela}
          onChange={(e) => setParcela(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--brand)", cursor: "pointer" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          <span>5%</span><span>50%</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 20 }}>
        {[
          ["Teto de remuneração por venda", temDados ? money(tetoVenda) : "—"],
          ["Referência de remuneração por reunião", temDados ? money(refReuniao) : "—"],
        ].map(([label, val]) => (
          <div key={label} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface-2)" }}>
            <div className="vx-mut" style={{ fontSize: 11.5, marginBottom: 6 }}>{label}</div>
            <div className="vx-mono" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--ink)" }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.55 }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        Simulação estimativa. Considere impostos, custos operacionais e outras comissões antes de definir os pagamentos.
      </div>
    </section>
  );
}

// ── Painel lateral: comissões de uma campanha ─────────────────────────────────
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
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", justifyContent: "flex-end" }}>
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
          {/* Seleção de tabela */}
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
                Valores herdados da tabela padrão da empresa. Ajuste-os em "Tabela padrão de comissões".
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                {ACOES_SEM_VENDA.map((k) => (
                  <label key={k}>
                    <div className="vx-label">{ACOES[k]?.nome || k}</div>
                    <InputMoeda value={tabela[k] ?? ""} onChange={(val) => setTabela((p) => ({ ...p, [k]: val }))} />
                  </label>
                ))}
              </div>
              <BlocoVenda
                modo={vendaModo} setModo={setVendaModo}
                valorFixo={tabela.venda ?? ""} setValorFixo={(val) => setTabela((p) => ({ ...p, venda: val }))}
                pct={pct} setPct={setPct} percentualHabilitado
              />
            </div>
          )}

          <NotaVigencia />
        </div>

        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid var(--border)", position: "sticky", bottom: 0, background: "var(--surface)" }}>
          <button className="vx-btn" style={{ flex: 1 }} onClick={onFechar}>Cancelar</button>
          <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} onClick={salvar}>Salvar configuração</button>
        </div>
      </aside>
    </div>
  );
}

function ConfigComissoes({ emp, db, up, aviso }) {
  const defaults = emp.comissoes || {};
  const [tabela, setTabela] = useState(() => mapaParaStrings(defaults));
  const [vendaModo, setVendaModo] = useState("fixo");
  const [painel, setPainel] = useState(null);

  // Recarrega quando a empresa ou a tabela salva mudam (sem sobrescrever edição).
  useEffect(() => { setTabela(mapaParaStrings(emp.comissoes || {})); setVendaModo("fixo"); }, [emp.id, emp.comissoes]);

  const campanhas = useMemo(
    () => (db.campaigns || []).filter((c) => c.companyId === emp.id),
    [db.campaigns, emp.id],
  );

  const alterado = useMemo(
    () => ORDEM_ACOES.some((k) => numeroOuNulo(tabela[k]) !== numeroBase(defaults[k])),
    [tabela, defaults],
  );

  const ehPadraoCampanha = (c) => tarefasIguais(c.tarefas, defaults) && !(Number(c.percentualComissao) > 0);

  const salvar = () => {
    const limpo = stringsParaMapa(tabela);
    apiPatch(`/companies/${emp.id}`, { comissoes: limpo });
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, comissoes: limpo } : c) }));
    aviso("Tabela padrão salva.");
  };

  const salvarCampanha = (campanha, patch) => {
    apiPatch(`/campaigns/${campanha.id}`, patch);
    up((d) => ({ campaigns: d.campaigns.map((c) => c.id === campanha.id ? { ...c, ...patch } : c) }));
    aviso("Comissões da campanha salvas.");
    setPainel(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 className="vx-disp" style={{ fontSize: 19, margin: 0 }}>Configurar Comissões</h2>
        <p className="vx-mut" style={{ fontSize: 13, margin: "4px 0 0" }}>Defina quanto os profissionais recebem por cada resultado comercial.</p>
      </div>

      {/* SEÇÃO 01 — Tabela padrão */}
      <section className="vx-card" style={{ padding: 22, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Tabela padrão de comissões</h2>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: "3px 0 0" }}>Valores utilizados automaticamente em campanhas sem configuração própria.</p>
          </div>
          <span className="vx-chip" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={12} /> Padrão da empresa</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          {ACOES_SEM_VENDA.map((k) => (
            <label key={k}>
              <div className="vx-label">{ACOES[k]?.nome || k}</div>
              <InputMoeda value={tabela[k] ?? ""} onChange={(val) => setTabela((p) => ({ ...p, [k]: val }))} />
            </label>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <BlocoVenda
            modo={vendaModo} setModo={setVendaModo}
            valorFixo={tabela.venda ?? ""} setValorFixo={(val) => setTabela((p) => ({ ...p, venda: val }))}
            pct="" setPct={() => {}} percentualHabilitado={false}
          />
        </div>

        <NotaVigencia />

        <div style={{ marginTop: 18 }}>
          <button className="vx-btn vx-btn-primary" onClick={salvar} disabled={!alterado}>Salvar alterações</button>
          {alterado && <span className="vx-mut" style={{ fontSize: 12, marginLeft: 12 }}>Alterações não salvas.</span>}
        </div>
      </section>

      {/* SEÇÃO 02 — Calculadora */}
      <Calculadora />

      {/* SEÇÃO 03 — Comissões por campanha */}
      <section className="vx-card" style={{ padding: 22 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Comissões por campanha</h2>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "3px 0 0" }}>Personalize os valores de pagamento de cada campanha.</p>
        </div>

        {campanhas.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 12 }}>
            <Megaphone size={24} color="var(--muted)" style={{ marginBottom: 8 }} />
            <div className="vx-disp" style={{ fontSize: 14 }}>Nenhuma campanha criada</div>
            <div className="vx-mut" style={{ fontSize: 12.5 }}>Crie uma campanha para personalizar suas comissões.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {campanhas.map((c) => {
              const padrao = ehPadraoCampanha(c);
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    <b style={{ fontSize: 14 }}>{c.titulo}</b>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className={`vx-campaign-status is-${c.status}`} style={{ fontSize: 11 }}>{c.status}</span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
                        background: padrao ? "var(--surface-2)" : "var(--brand-50)",
                        color: padrao ? "var(--muted)" : "var(--brand)",
                        border: `1px solid ${padrao ? "var(--border)" : "var(--brand)"}`,
                      }}>
                        {padrao ? "Tabela padrão" : "Personalizada"}
                      </span>
                    </div>
                  </div>
                  <button className="vx-btn vx-btn-sm" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }} onClick={() => setPainel(c)}>
                    <Settings2 size={14} /> Personalizar comissões <ChevronRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {painel && (
        <PainelComissaoCampanha
          campanha={painel} defaults={defaults}
          onFechar={() => setPainel(null)} onSalvar={salvarCampanha}
        />
      )}
    </div>
  );
}

const VISOES_POR_ESCOPO = {
  orcamento: [["orcamento", "Orçamento"]],
  comissoes: [["comissoes", "Comissões"], ["config", "Configurar comissões"]],
};

export default function ValoresEmpresa({ emp, db, up, aviso, onAdicionarSaldo, escopo = "orcamento" }) {
  const visoes = VISOES_POR_ESCOPO[escopo] || VISOES_POR_ESCOPO.orcamento;
  const [visao, setVisao] = useState(visoes[0][0]);
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
            ? "Comissões dos profissionais e configuração das tabelas de pagamento."
            : "Orçamentos das campanhas para o pagamento dos profissionais."}</p>
        </div>
        {!ehComissoes && (
          <button className="vx-btn vx-btn-primary" style={{ flexShrink: 0, gap: 7 }} onClick={() => onAdicionarSaldo?.()}>
            <Wallet size={15} /> Adicionar Saldo
          </button>
        )}
      </div>

      {visoes.length > 1 && (
        <div className="vx-seg vx-subnav" style={{ marginBottom: 20 }}>
          {visoes.map(([key, label]) => (
            <button key={key} data-on={visao === key ? "1" : "0"} onClick={() => setVisao(key)}>{label}</button>
          ))}
        </div>
      )}

      {visao === "orcamento" && <OrcamentoCampanhas campanhas={campanhas} />}
      {visao === "comissoes" && <Comissoes emp={emp} />}
      {visao === "config" && <ConfigComissoes emp={emp} db={db} up={up} aviso={aviso} />}
    </div>
  );
}
