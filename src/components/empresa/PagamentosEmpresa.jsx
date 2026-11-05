import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpCircle, Check, ChevronRight, CreditCard, Download,
  Landmark, Lock, Plus, QrCode, TrendingUp, Wallet, X, Zap,
} from "lucide-react";
import { api, API_URL } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { PLANOS, ORDEM_PLANOS } from "../../../shared/planos.js";
import { isPosPago, isPremium } from "../../../shared/empresa.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const PLANOS_VISIVEIS = ORDEM_PLANOS.filter((k) => PLANOS[k]?.preco > 0);

const MOVIMENTOS = {
  deposito:        { nome: "Depósito",          cor: "var(--brand)" },
  reserva:         { nome: "Reserva",           cor: "var(--amber,#b45309)" },
  estorno_reserva: { nome: "Estorno de reserva",cor: "var(--muted)" },
  liquidacao:      { nome: "Pagamento",         cor: "#DC2626" },
};

const STATUS_MOV = {
  confirmado:   { label: "Confirmado",  bg: "#DCFCE7", color: "#16A34A" },
  pendente:     { label: "Pendente",    bg: "#FEF9C3", color: "#B45309" },
  processando:  { label: "Processando", bg: "#EFF6FF", color: "#1D4ED8" },
  recusado:     { label: "Recusado",    bg: "#FEE2E2", color: "#DC2626" },
};

function StatusPill({ status = "confirmado" }) {
  const cfg = STATUS_MOV[status] || STATUS_MOV.confirmado;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, sub, tone = "default", icon: Icon }) {
  const corMap = { brand: "var(--brand)", red: "#DC2626", amber: "#B45309", muted: "var(--muted)", default: "var(--ink)" };
  const bgMap  = { brand: "#EFF6FF", red: "#FEF2F2", amber: "#FFFBEB", muted: "var(--surface-2)", default: "var(--surface)" };
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {Icon && (
          <span style={{ width: 32, height: 32, borderRadius: 8, background: bgMap[tone], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={15} color={corMap[tone]} strokeWidth={2.2} />
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: corMap[tone], fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Modal adicionar saldo ─────────────────────────────────────────────────────
function ModalSaldo({ emp, aviso, aoConfirmar, onFechar }) {
  const [valor, setValor] = useState("");
  const [display, setDisplay] = useState("");
  const [etapa, setEtapa] = useState("form"); // form | pix
  const [pix, setPix] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const parseBRL = (s) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
  const fmtBRL  = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleValor = (e) => {
    const raw = e.target.value.replace(/[^\d,]/g, "");
    setDisplay(raw);
    setValor(parseBRL(raw));
  };
  const handleBlur = () => {
    const n = parseBRL(display);
    setDisplay(n > 0 ? fmtBRL(n) : "");
    setValor(n);
  };

  const confirmar = async () => {
    if (!valor || valor < 50) return aviso("Valor mínimo de R$ 50,00.");
    setEnviando(true);
    const r = await api("/deposits", { valor });
    setEnviando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível criar o depósito.");
    if (r.pixCopiaECola || r.pixQrCodeBase64) { setPix(r); setEtapa("pix"); return; }
    if (r.invoiceUrl) { window.open(r.invoiceUrl, "_blank", "noopener"); aviso("Fatura aberta em nova aba."); onFechar(); return; }
    aviso("Depósito registrado. Aguarde a confirmação.");
    aoConfirmar?.();
    onFechar();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", boxShadow: "0 24px 48px rgba(0,0,0,.18)", width: "100%", maxWidth: 440, padding: "28px 28px 24px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Adicionar saldo</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>O valor entra na sua conta após a confirmação do Pix.</div>
          </div>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}><X size={18} /></button>
        </div>

        {etapa === "form" && <>
          <label style={{ display: "block", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>Valor do depósito</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13.5, pointerEvents: "none" }}>R$</span>
              <input
                className="vx-input vx-mono"
                style={{ paddingLeft: 32, fontSize: 18, fontWeight: 700 }}
                inputMode="decimal" placeholder="0,00"
                value={display} onChange={handleValor} onBlur={handleBlur}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>Mínimo: R$ 50,00 · Via Pix · Confirmação em até 1 minuto</div>
          </label>

          {valor >= 50 && (
            <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "var(--muted)" }}>Valor depositado</span><b>{money(valor)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--muted)" }}>Taxa de gateway</span><b>R$ 0,00</b></div>
              <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 700 }}>Saldo creditado</span><b style={{ color: "var(--brand)" }}>{money(valor)}</b></div>
            </div>
          )}

          <button
            className="vx-btn vx-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "11px 0", fontSize: 14 }}
            onClick={confirmar} disabled={enviando || !valor || valor < 50}
          >
            {enviando ? "Gerando Pix…" : <><QrCode size={15} /> Gerar Pix</>}
          </button>
        </>}

        {etapa === "pix" && pix && (
          <div style={{ textAlign: "center" }}>
            {pix.pixQrCodeBase64 && (
              <img src={`data:image/png;base64,${pix.pixQrCodeBase64}`} alt="QR Code Pix"
                style={{ width: 180, height: 180, margin: "0 auto 14px", display: "block", borderRadius: 10 }} />
            )}
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Pague {money(valor)} via Pix</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>O saldo é creditado automaticamente após a confirmação.</div>
            {pix.pixCopiaECola && (
              <button className="vx-btn vx-btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 8 }}
                onClick={() => { navigator.clipboard?.writeText(pix.pixCopiaECola); aviso("Código copiado."); }}>
                Copiar código Pix
              </button>
            )}
            <button className="vx-btn" style={{ width: "100%", justifyContent: "center" }} onClick={onFechar}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Seção de planos ───────────────────────────────────────────────────────────
function CardPlano({ chave, plano, atual, temAssinatura, onContratar }) {
  const ehAtual = atual === chave;
  return (
    <div style={{
      border: `2px solid ${ehAtual ? "var(--brand)" : "var(--border)"}`,
      borderRadius: "var(--radius)", padding: "20px 18px",
      background: ehAtual ? "#EFF6FF" : "var(--surface)",
      position: "relative", display: "flex", flexDirection: "column", gap: 12,
    }}>
      {ehAtual && (
        <span style={{ position: "absolute", top: -11, left: 16, background: "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
          Seu plano atual
        </span>
      )}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{plano.nome}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: ehAtual ? "var(--brand)" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
          {plano.preco === 0 ? "Grátis" : money(plano.preco)}
          {plano.preco > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)" }}>/mês</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
          Take rate: {(plano.takeRate * 100).toFixed(0)}%
        </div>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        {(plano.inclui || []).map((item) => (
          <li key={item} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink-2)" }}>
            <Check size={13} color="var(--brand)" strokeWidth={2.5} />
            {item}
          </li>
        ))}
      </ul>
      <button
        className={ehAtual ? "vx-btn vx-btn-sm" : "vx-btn vx-btn-primary vx-btn-sm"}
        style={{ marginTop: "auto", justifyContent: "center" }}
        disabled={ehAtual}
        onClick={() => !ehAtual && onContratar(chave)}
      >
        {ehAtual ? "Plano atual" : temAssinatura ? "Alterar para este plano" : "Contratar plano"}
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PagamentosEmpresa({ emp, db, aviso, recarregar }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState({ dias: "30", tipo: "" });
  const [modalSaldo, setModalSaldo] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filtros.dias) p.set("dias", filtros.dias);
    if (filtros.tipo) p.set("tipo", filtros.tipo);
    return p.toString();
  }, [filtros]);

  const carregar = () => {
    setCarregando(true);
    setErro("");
    api(`/company/finance?${query}`).then((r) => {
      setCarregando(false);
      if (!r || r.error) return setErro(r?.error || "Não foi possível carregar os dados.");
      setDados(r);
    });
  };

  useEffect(() => { carregar(); }, [query]);

  const exportar = () => {
    window.open(`${API_URL}/api/company/finance/export?${query}`, "_blank");
    aviso?.("Extrato exportado em CSV.");
  };

  const planoAtual   = emp.assinatura || null;
  const temAssinatura = !!planoAtual && planoAtual !== "free";
  const infPlano     = planoAtual ? PLANOS[planoAtual] : null;
  const premium      = isPremium(emp);
  const posPago      = isPosPago(emp);

  const posicao  = dados?.posicao  || { saldo: 0, reservado: 0, disponivel: 0 };
  const resumo   = dados?.resumo   || { depositado: 0, utilizado: 0, taxas: 0, repassado: 0, movimentos: 0 };
  const extrato  = dados?.extrato  || [];

  // Métricas de resultado — valores das campanhas desta empresa
  const campanhas = (db.campaigns || []).filter((c) => c.companyId === emp.id);
  const submissoes = (db.submissions || []).filter((s) => s.companyId === emp.id && s.status === "liberado");
  const resultadoGerado = submissoes.reduce((acc, s) => acc + Number(s.valor || 0), 0);
  const retorno = resumo.repassado > 0 ? (resultadoGerado / resumo.repassado).toFixed(1) : null;

  const contratar = (chave) => {
    aviso("Para alterar seu plano, acesse as configurações de assinatura.");
  };

  return (
    <div className="vx-fade">
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 3px", letterSpacing: -0.3 }}>Pagamentos</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Plano, saldo operacional, remunerações e histórico financeiro.</p>
        </div>
        <button className="vx-btn vx-btn-sm" onClick={exportar} disabled={!extrato.length}>
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {/* ── 1. Plano da plataforma ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Plano da plataforma</div>
        {premium ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>
              <Zap size={16} color="var(--brand)" strokeWidth={2.5} /> Premium
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Concedido pela plataforma · sem mensalidade</span>
            <span style={{ background: "#DCFCE7", color: "#16A34A", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>Ativo</span>
          </div>
        ) : !temAssinatura ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 3 }}>Nenhum plano ativo</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Escolha um plano para desbloquear todos os recursos da RYCS.</div>
            </div>
            <span style={{ background: "#FEF9C3", color: "#B45309", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>Pendente</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{infPlano?.nome || planoAtual}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  {infPlano?.preco > 0 ? `${money(infPlano.preco)}/mês` : "Sem mensalidade"} · Recorrência mensal
                </div>
              </div>
              <span style={{ background: "#DCFCE7", color: "#16A34A", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>Ativo</span>
            </div>
            <button className="vx-btn vx-btn-sm" onClick={() => contratar(null)}>Alterar plano</button>
          </div>
        )}
      </div>

      {/* ── 2. Saldo operacional ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 4 }}>Saldo operacional</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)", fontVariantNumeric: "tabular-nums", letterSpacing: -0.8 }}>
              {carregando ? "—" : money(posPago ? Infinity : posicao.disponivel)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Disponível para remunerar profissionais</div>
          </div>
          {!posPago && !premium && (
            <button className="vx-btn vx-btn-primary" onClick={() => setModalSaldo(true)}>
              <Plus size={14} /> Adicionar saldo
            </button>
          )}
          {(posPago || premium) && (
            <span style={{ background: "#EFF6FF", color: "var(--brand)", fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 20 }}>
              {posPago ? "Pós-pago" : "Sem limite"}
            </span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>Reservado em ações</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#B45309", fontVariantNumeric: "tabular-nums" }}>{carregando ? "—" : money(posicao.reservado)}</div>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>Total depositado</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{carregando ? "—" : money(resumo.depositado)}</div>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>Pago a profissionais</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>{carregando ? "—" : money(resumo.repassado)}</div>
          </div>
        </div>
      </div>

      {/* ── 3. Resultados financeiros ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 10 }}>Resultados financeiros</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <StatCard label="Resultado gerado" value={money(resultadoGerado)} icon={TrendingUp} tone="brand"
            sub={`${submissoes.length} ação${submissoes.length !== 1 ? "ões" : ""} liberada${submissoes.length !== 1 ? "s" : ""}`} />
          <StatCard label="Total pago" value={money(resumo.repassado)} icon={Wallet} tone="red"
            sub="Repassado a profissionais" />
          <StatCard label="Pagamentos pendentes" value={money(posicao.reservado)} icon={Lock} tone="amber"
            sub="Ações aguardando liberação" />
          <StatCard label="Retorno" value={retorno ? `${retorno}×` : "—"} icon={TrendingUp} tone={retorno && retorno >= 1 ? "brand" : "muted"}
            sub={retorno ? "Resultado ÷ remuneração" : "Sem dados suficientes"} />
        </div>

        {/* Barra comparativa */}
        {(resultadoGerado > 0 || resumo.repassado > 0) && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 18px", marginTop: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>Resultado gerado × Remuneração paga</div>
            {[
              { label: "Resultado gerado", value: resultadoGerado, cor: "var(--brand)" },
              { label: "Pago a profissionais", value: resumo.repassado, cor: "#DC2626" },
            ].map(({ label, value, cor }) => {
              const max = Math.max(resultadoGerado, resumo.repassado, 1);
              const pct = Math.round((value / max) * 100);
              return (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                    <span>{label}</span><b style={{ color: "var(--ink)" }}>{money(value)}</b>
                  </div>
                  <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: cor, borderRadius: 4, transition: "width .5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. Histórico / movimentações ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase" }}>Movimentações financeiras</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="vx-input" style={{ fontSize: 12, padding: "5px 10px", height: "auto" }}
              value={filtros.dias} onChange={(e) => setFiltros({ ...filtros, dias: e.target.value })}>
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="">Todo período</option>
            </select>
            <select className="vx-input" style={{ fontSize: 12, padding: "5px 10px", height: "auto" }}
              value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
              <option value="">Todas categorias</option>
              {Object.entries(MOVIMENTOS).map(([k, m]) => <option key={k} value={k}>{m.nome}</option>)}
            </select>
          </div>
        </div>

        {carregando && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            {[0,1,2].map((i) => <div key={i} className="vx-skeleton" style={{ height: 16, marginBottom: 10, opacity: 1 - i * 0.2 }} />)}
          </div>
        )}

        {!carregando && erro && (
          <div style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "var(--radius)", color: "#DC2626", fontSize: 13 }}>{erro}</div>
        )}

        {!carregando && !erro && !extrato.length && (
          <div style={{ textAlign: "center", padding: "36px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <Landmark size={28} color="var(--muted)" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Nenhuma movimentação</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Depósitos e pagamentos a profissionais aparecerão aqui.</p>
          </div>
        )}

        {!carregando && !erro && !!extrato.length && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Data", "Categoria", "Descrição", "Valor", "Status"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: h === "Valor" ? "right" : "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extrato.map((l, i) => {
                    const m = MOVIMENTOS[l.tipo] || { nome: l.tipo, cor: "var(--muted)" };
                    return (
                      <tr key={l.id || i} style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}>
                        <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>{dataCurta(l.criadoEm)}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: m.cor }}>{m.nome}</span>
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ fontWeight: 500, color: "var(--ink)" }}>{l.referencia || l.campanha || "—"}</div>
                          {l.profissional && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{l.profissional}</div>}
                        </td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: l.valor < 0 ? "#DC2626" : "var(--brand)" }}>
                          {l.valor < 0 ? "−" : "+"}{money(Math.abs(l.valor))}
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <StatusPill status={l.status || "confirmado"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Planos disponíveis ── */}
      {!premium && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Conheça nossos planos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {PLANOS_VISIVEIS.map((chave) => (
              <CardPlano
                key={chave}
                chave={chave}
                plano={PLANOS[chave]}
                atual={planoAtual}
                temAssinatura={temAssinatura}
                onContratar={contratar}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Modal adicionar saldo ── */}
      {modalSaldo && (
        <ModalSaldo
          emp={emp}
          aviso={aviso}
          aoConfirmar={() => { recarregar?.(); carregar(); }}
          onFechar={() => setModalSaldo(false)}
        />
      )}
    </div>
  );
}
