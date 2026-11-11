import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpCircle, Check, ChevronRight, CreditCard,
  Landmark, Lock, Plus, QrCode, TrendingUp, Wallet, X, Zap,
} from "lucide-react";
import PlanosEmpresa from "./PlanosEmpresa.jsx";
import ValoresEmpresa from "./ValoresEmpresa.jsx";
import AbastecerCaixa from "./AbastecerCaixa.jsx";
import DestaqueEmpresa from "./DestaqueEmpresa.jsx";
import { api } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { isPosPago, isPremium } from "../../../shared/empresa.js";
import { PLANOS } from "../../../shared/planos.js";
import { useI18n } from "../../lib/i18n.jsx";

// ── Helpers ───────────────────────────────────────────────────────────────────
const MOVIMENTOS_CORES = {
  deposito:        "var(--brand)",
  reserva:         "var(--amber,#b45309)",
  estorno_reserva: "var(--muted)",
  liquidacao:      "#DC2626",
};
function buildMovimentos(t) {
  return {
    deposito:        { nome: t("pay.mov.deposit"),       cor: MOVIMENTOS_CORES.deposito },
    reserva:         { nome: t("pay.mov.reserve"),       cor: MOVIMENTOS_CORES.reserva },
    estorno_reserva: { nome: t("pay.mov.reversal"),      cor: MOVIMENTOS_CORES.estorno_reserva },
    liquidacao:      { nome: t("pay.mov.payment"),       cor: MOVIMENTOS_CORES.liquidacao },
  };
}

const STATUS_MOV_STYLES = {
  confirmado:   { bg: "#DCFCE7", color: "#16A34A" },
  pendente:     { bg: "#FEF9C3", color: "#B45309" },
  processando:  { bg: "#EFF6FF", color: "#1D4ED8" },
  recusado:     { bg: "#FEE2E2", color: "#DC2626" },
};
function buildStatusMov(t) {
  return {
    confirmado:   { label: t("pay.status.confirmed"),  ...STATUS_MOV_STYLES.confirmado },
    pendente:     { label: t("pay.status.pending"),    ...STATUS_MOV_STYLES.pendente },
    processando:  { label: t("pay.status.processing"), ...STATUS_MOV_STYLES.processando },
    recusado:     { label: t("pay.status.rejected"),   ...STATUS_MOV_STYLES.recusado },
  };
}

function StatusPill({ status = "confirmado" }) {
  const { t } = useI18n();
  const STATUS_MOV = buildStatusMov(t);
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
export function ModalSaldo({ emp, aviso, aoConfirmar, onFechar }) {
  const { t } = useI18n();
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
    if (!valor || valor < 50) return aviso(t("pay.modal.minError"));
    setEnviando(true);
    const r = await api("/deposits", { valor });
    setEnviando(false);
    if (!r || r.error) return aviso(r?.error || t("pay.modal.createError"));
    if (r.pixCopiaECola || r.pixQrCodeBase64) { setPix(r); setEtapa("pix"); return; }
    if (r.invoiceUrl) { window.open(r.invoiceUrl, "_blank", "noopener"); aviso(t("pay.modal.invoiceOpened")); onFechar(); return; }
    aviso(t("pay.modal.depositRegistered"));
    aoConfirmar?.();
    onFechar();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(248,250,252,.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 20px 50px rgba(0,0,0,.14)", width: "100%", maxWidth: 440, padding: "28px 28px 24px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{t("pay.modal.title")}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{t("pay.modal.subtitle")}</div>
          </div>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}><X size={18} /></button>
        </div>

        {etapa === "form" && <>
          <label style={{ display: "block", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>{t("pay.modal.depositAmount")}</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13.5, pointerEvents: "none" }}>R$</span>
              <input
                className="vx-input vx-mono"
                style={{ paddingLeft: 32, fontSize: 18, fontWeight: 700 }}
                inputMode="decimal" placeholder="0,00"
                value={display} onChange={handleValor} onBlur={handleBlur}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>{t("pay.modal.minHint")}</div>
          </label>

          {valor >= 50 && (
            <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "var(--muted)" }}>{t("pay.modal.amountDeposited")}</span><b>{money(valor)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--muted)" }}>{t("pay.modal.gatewayFee")}</span><b>R$ 0,00</b></div>
              <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 700 }}>{t("pay.modal.creditedBalance")}</span><b style={{ color: "var(--brand)" }}>{money(valor)}</b></div>
            </div>
          )}

          <button
            className="vx-btn vx-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "11px 0", fontSize: 14 }}
            onClick={confirmar} disabled={enviando || !valor || valor < 50}
          >
            {enviando ? t("pay.modal.generatingPix") : <><QrCode size={15} /> {t("pay.modal.generatePix")}</>}
          </button>
        </>}

        {etapa === "pix" && pix && (
          <div style={{ textAlign: "center" }}>
            {pix.pixQrCodeBase64 && (
              <img src={`data:image/png;base64,${pix.pixQrCodeBase64}`} alt="QR Code Pix"
                style={{ width: 180, height: 180, margin: "0 auto 14px", display: "block", borderRadius: 10 }} />
            )}
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("pay.modal.payViaPix", { valor: money(valor) })}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>{t("pay.modal.autoCredit")}</div>
            {pix.pixCopiaECola && (
              <button className="vx-btn vx-btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 8 }}
                onClick={() => { navigator.clipboard?.writeText(pix.pixCopiaECola); aviso(t("pay.modal.codeCopied")); }}>
                {t("pay.modal.copyPixCode")}
              </button>
            )}
            <button className="vx-btn" style={{ width: "100%", justifyContent: "center" }} onClick={onFechar}>{t("app.close")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PagamentosEmpresa({ emp, db, up, aviso, recarregar, secao = "plano", onTrocarSecao }) {
  const { t } = useI18n();
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
      if (!r || r.error) return setErro(r?.error || t("pay.loadError"));
      setDados(r);
    });
  };

  useEffect(() => { carregar(); }, [query]);

  const planoAtual = emp.assinatura || null;
  const infPlano   = planoAtual ? PLANOS[planoAtual] : null;
  const premium    = isPremium(emp);
  const posPago    = isPosPago(emp);
  // Tem plano pago ativo? (free/sem assinatura não conta; premium é tratado à parte.)
  const temAssinatura = !!planoAtual && planoAtual !== "free";

  const posicao  = dados?.posicao  || { saldo: 0, reservado: 0, disponivel: 0 };
  const resumo   = dados?.resumo   || { depositado: 0, utilizado: 0, taxas: 0, repassado: 0, movimentos: 0 };
  const extrato  = dados?.extrato  || [];

  // Métricas de resultado — valores das campanhas desta empresa
  const campanhas = (db.campaigns || []).filter((c) => c.companyId === emp.id);
  const submissoes = (db.submissions || []).filter((s) => s.companyId === emp.id && s.status === "liberado");
  const resultadoGerado = submissoes.reduce((acc, s) => acc + Number(s.valor || 0), 0);
  const retorno = resumo.repassado > 0 ? (resultadoGerado / resumo.repassado).toFixed(1) : null;

  return (
    <div className="vx-fade">
      {/* ── Tarja: empresa sem plano contratado (não aparece na seção Campanhas) ── */}
      {!temAssinatura && !premium && secao !== "campanhas" && (
        <div style={{
          background: "linear-gradient(90deg,var(--brand) 0%,var(--sky-600,#0ea5e9) 100%)",
          color: "#fff", padding: "12px 18px", minHeight: 48, borderRadius: 12, marginBottom: 18,
          display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 8px rgba(0,0,0,.14)",
        }}>
          <Zap size={16} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t("pay.subscribePlan")}</span>
        </div>
      )}


      {secao === "plano" && <>
      {/* ── Planos disponíveis ── */}
      <div style={{ marginBottom: 24 }}>
        <PlanosEmpresa aviso={aviso} recarregar={recarregar} />
      </div>

      {/* ── Destaque da empresa (independente do plano) ── */}
      <DestaqueEmpresa emp={emp} up={up} aviso={aviso} />

      </>}

      {secao === "campanhas" && (
        <>
          <ValoresEmpresa emp={emp} db={db} up={up} aviso={aviso} onAdicionarSaldo={() => setModalSaldo(true)} />
          <AbastecerCaixa emp={emp} db={db} up={up} aviso={aviso} />
        </>
      )}

      {secao === "movimentacoes" && <>
      {/* ── 2. Saldo operacional ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 4 }}>{t("pay.operationalBalance")}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)", fontVariantNumeric: "tabular-nums", letterSpacing: -0.8 }}>
              {carregando ? "—" : money(posPago ? Infinity : posicao.disponivel)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{t("pay.availableForPros")}</div>
          </div>
          {!posPago && !premium && (
            <button className="vx-btn vx-btn-primary" onClick={() => setModalSaldo(true)}>
              <Plus size={14} /> {t("pay.addBalance")}
            </button>
          )}
          {(posPago || premium) && (
            <span style={{ background: "#EFF6FF", color: "var(--brand)", fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 20 }}>
              {posPago ? t("pay.postPaid") : t("pay.noLimit")}
            </span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{t("pay.reservedInActions")}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#B45309", fontVariantNumeric: "tabular-nums" }}>{carregando ? "—" : money(posicao.reservado)}</div>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{t("pay.totalDeposited")}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{carregando ? "—" : money(resumo.depositado)}</div>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{t("pay.paidToPros")}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>{carregando ? "—" : money(resumo.repassado)}</div>
          </div>
        </div>
      </div>

      {/* ── 3. Resultados financeiros ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 10 }}>{t("pay.financialResults")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <StatCard label={t("pay.generatedResult")} value={money(resultadoGerado)} icon={TrendingUp} tone="brand"
            sub={t("pay.actionsReleased", { count: submissoes.length })} />
          <StatCard label={t("payments.total")} value={money(resumo.repassado)} icon={Wallet} tone="red"
            sub={t("pay.forwardedToPros")} />
          <StatCard label={t("pay.pendingPayments")} value={money(posicao.reservado)} icon={Lock} tone="amber"
            sub={t("pay.actionsAwaitingRelease")} />
          <StatCard label={t("pay.returnLabel")} value={retorno ? `${retorno}×` : "—"} icon={TrendingUp} tone={retorno && retorno >= 1 ? "brand" : "muted"}
            sub={retorno ? t("pay.resultDivRemuneration") : t("pay.insufficientData")} />
        </div>

        {/* Barra comparativa */}
        {(resultadoGerado > 0 || resumo.repassado > 0) && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 18px", marginTop: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pay.resultVsRemuneration")}</div>
            {[
              { label: t("pay.generatedResult"), value: resultadoGerado, cor: "var(--brand)" },
              { label: t("pay.paidToPros"), value: resumo.repassado, cor: "#DC2626" },
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase" }}>{t("pay.transactions")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="vx-input" style={{ fontSize: 12, padding: "5px 10px", height: "auto" }}
              value={filtros.dias} onChange={(e) => setFiltros({ ...filtros, dias: e.target.value })}>
              <option value="7">{t("pay.filter.7days")}</option>
              <option value="30">{t("pay.filter.30days")}</option>
              <option value="90">{t("pay.filter.90days")}</option>
              <option value="">{t("pay.filter.allPeriod")}</option>
            </select>
            <select className="vx-input" style={{ fontSize: 12, padding: "5px 10px", height: "auto" }}
              value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
              <option value="">{t("pay.filter.allCategories")}</option>
              {Object.entries(buildMovimentos(t)).map(([k, m]) => <option key={k} value={k}>{m.nome}</option>)}
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
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{t("pay.noTransactions")}</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{t("pay.noTransactionsDesc")}</p>
          </div>
        )}

        {!carregando && !erro && !!extrato.length && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {[
                      { key: "date", label: t("pay.table.date") },
                      { key: "category", label: t("pay.table.category") },
                      { key: "description", label: t("pay.table.description") },
                      { key: "amount", label: t("pay.table.amount") },
                      { key: "status", label: t("pay.table.status") },
                    ].map((h) => (
                      <th key={h.key} style={{ padding: "10px 14px", textAlign: h.key === "amount" ? "right" : "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extrato.map((l, i) => {
                    const MOVIMENTOS = buildMovimentos(t);
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

      </>}

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
