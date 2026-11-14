import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpCircle, Check, ChevronDown, ChevronRight, CreditCard,
  Landmark, Lock, Plus, QrCode, Search, TrendingUp, Wallet, X, Zap,
} from "lucide-react";
import PlanosEmpresa from "./PlanosEmpresa.jsx";
import CentralPagamentosCampanhas from "./CentralPagamentosCampanhas.jsx";
import { api } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { isPremium } from "../../../shared/empresa.js";
import { PLANOS } from "../../../shared/planos.js";
import { MOEDAS, moedaDe, formatarMoeda, normalizarMoeda } from "../../../shared/moedas.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
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
// Seletor de moeda pesquisável: combina busca por texto com a seleção.
function SeletorMoeda({ moeda, onSelecionar, disabled }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef(null);
  const info = moedaDe(moeda);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) { setAberto(false); setBusca(""); } };
    const esc = (e) => { if (e.key === "Escape") { setAberto(false); setBusca(""); } };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const q = busca.trim().toLowerCase();
  const lista = q ? MOEDAS.filter((m) => `${m.simbolo} ${m.code} ${m.nome}`.toLowerCase().includes(q)) : MOEDAS;
  const escolher = (code) => { onSelecionar(code); setAberto(false); setBusca(""); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button" className="vx-input" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={aberto}
        onClick={() => !disabled && setAberto((v) => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left", fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.7 : 1 }}
      >
        <span>{info.simbolo} · {moeda} — {info.nome}</span>
        {!disabled && <ChevronDown size={15} color="var(--muted)" style={{ transform: aberto ? "rotate(180deg)" : "none", transition: ".15s", flexShrink: 0 }} />}
      </button>

      {aberto && !disabled && (
        <div role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 120, background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(17,24,39,.16)", overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid var(--border)", position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            <input
              autoFocus className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar moeda..."
              onKeyDown={(e) => { if (e.key === "Enter" && lista[0]) { e.preventDefault(); escolher(lista[0].code); } }}
              style={{ paddingLeft: 32, fontSize: 13, height: "auto", padding: "8px 10px 8px 32px" }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {!lista.length && <div style={{ padding: "14px 12px", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>Nenhuma moeda encontrada.</div>}
            {lista.map((m) => {
              const sel = m.code === moeda;
              return (
                <button
                  key={m.code} type="button" role="option" aria-selected={sel}
                  onClick={() => escolher(m.code)}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", border: "none", background: sel ? "var(--brand-50)" : "transparent", color: sel ? "var(--brand)" : "var(--ink)", cursor: "pointer", fontSize: 13.5, fontWeight: sel ? 600 : 400 }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 16, flexShrink: 0, display: "inline-flex" }}>{sel && <Check size={14} />}</span>
                  <span>{m.simbolo} · {m.code} — {m.nome}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ModalSaldo({ emp, aviso, aoConfirmar, onFechar }) {
  // Moeda travada: depois do 1º aporte a empresa opera sempre na mesma moeda.
  const moedaTravada = (Number(emp?.saldo) > 0 || Number(emp?.totalAportado) > 0)
    ? normalizarMoeda(emp?.moeda) : null;

  const [moeda, setMoeda] = useState(moedaTravada || normalizarMoeda(emp?.moeda) || "BRL");
  const [metodo, setMetodo] = useState(moeda === "BRL" ? "pix" : "card");
  const [valor, setValor] = useState(0);
  const [display, setDisplay] = useState("");
  const [etapa, setEtapa] = useState("form"); // form | pix
  const [pix, setPix] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const info = moedaDe(moeda);
  const digitos = info.digitos;
  const piso = moeda === "BRL" ? 10 : (digitos === 0 ? 100 : 10);
  const atalhos = moeda === "BRL" ? [10, 50, 100] : (digitos === 0 ? [500, 1000, 5000] : [50, 100, 500]);
  const fmt = (n) => formatarMoeda(n, moeda);

  const parseValor = (s) => {
    // Aceita dígitos e um separador decimal (vírgula ou ponto). Moedas sem
    // centavos ignoram a parte decimal.
    const limpo = String(s).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const n = Number(limpo) || 0;
    return digitos === 0 ? Math.round(n) : n;
  };
  const handleValor = (e) => {
    const raw = e.target.value.replace(digitos === 0 ? /[^\d]/g : /[^\d.,]/g, "");
    setDisplay(raw);
    setValor(parseValor(raw));
  };
  const handleBlur = () => {
    const n = parseValor(display);
    setDisplay(n > 0 ? n.toLocaleString("pt-BR", { minimumFractionDigits: digitos, maximumFractionDigits: digitos }) : "");
    setValor(n);
  };
  // Ao trocar de moeda, ajusta o método (Pix só existe em BRL) e zera o valor.
  const trocarMoeda = (m) => {
    const nova = normalizarMoeda(m);
    setMoeda(nova);
    setMetodo(nova === "BRL" ? "pix" : "card");
    setValor(0); setDisplay("");
  };

  const confirmar = async () => {
    if (!valor || valor < piso) return aviso(`Valor mínimo de ${fmt(piso)}.`);
    setEnviando(true);
    const r = await api("/deposits", { valor, moeda, metodo, retorno: window.location.pathname });
    setEnviando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível criar o depósito.");
    // Cartão internacional: redireciona para o Checkout hospedado do Stripe.
    if (r.checkoutUrl) { window.location.href = r.checkoutUrl; return; }
    if (r.pixCopiaECola || r.pixQrCodeBase64) { setPix(r); setEtapa("pix"); return; }
    if (r.invoiceUrl) { window.open(r.invoiceUrl, "_blank", "noopener"); aviso("Fatura aberta em nova aba."); onFechar(); return; }
    aviso("Depósito registrado. Aguarde a confirmação.");
    aoConfirmar?.();
    onFechar();
  };

  const metodos = moeda === "BRL"
    ? [["pix", "Pix", QrCode], ["card", "Internacional (cartão)", CreditCard]]
    : [["card", "Internacional (cartão)", CreditCard]];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(248,250,252,.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 20px 50px rgba(0,0,0,.14)", width: "100%", maxWidth: 440, padding: "28px 28px 24px", maxHeight: "90vh", overflowY: "auto" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Adicionar saldo</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
              {metodo === "pix" ? "O valor entra na sua conta após a confirmação do Pix." : "O valor entra na sua conta após a confirmação do pagamento."}
            </div>
          </div>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}><X size={18} /></button>
        </div>

        {etapa === "form" && <>
          {/* Seletor de moeda */}
          <label style={{ display: "block", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>Moeda</div>
            <SeletorMoeda moeda={moeda} onSelecionar={trocarMoeda} disabled={!!moedaTravada} />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
              {moedaTravada
                ? `Sua conta opera em ${moedaTravada}. Depósitos, repasses e saques acontecem nesta moeda.`
                : "Esta será a moeda da sua conta — fica fixa após o primeiro depósito."}
            </div>
          </label>

          <label style={{ display: "block", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>Valor do depósito</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13.5, pointerEvents: "none" }}>{info.simbolo}</span>
              <input
                className="vx-input vx-mono"
                style={{ paddingLeft: 12 + info.simbolo.length * 9, fontSize: 18, fontWeight: 700 }}
                inputMode="decimal" placeholder={digitos === 0 ? "0" : "0,00"}
                value={display} onChange={handleValor} onBlur={handleBlur}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
              Mínimo: {fmt(piso)}{metodo === "pix" ? " · Via Pix · Confirmação em até 1 minuto" : " · Via cartão (Stripe)"}
            </div>
          </label>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {atalhos.map((v) => (
              <button key={v} type="button" className="vx-btn vx-btn-sm" style={{ flex: 1, justifyContent: "center" }}
                data-on={valor === v ? "1" : "0"}
                onClick={() => { setValor(v); setDisplay(v.toLocaleString("pt-BR", { minimumFractionDigits: digitos, maximumFractionDigits: digitos })); }}>
                {fmt(v)}
              </button>
            ))}
          </div>

          {/* Tipo de pagamento */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 7 }}>Tipo de pagamento</div>
            <div style={{ display: "flex", gap: 8 }}>
              {metodos.map(([id, label, Icon]) => {
                const on = metodo === id;
                return (
                  <button key={id} type="button" onClick={() => setMetodo(id)} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
                    border: `1.5px solid ${on ? "var(--brand)" : "var(--border)"}`,
                    background: on ? "var(--brand-50)" : "var(--surface)", color: on ? "var(--brand)" : "var(--ink)",
                  }}>
                    <Icon size={15} /> {label}
                  </button>
                );
              })}
            </div>
            {metodo === "card" && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 7, lineHeight: 1.45 }}>
                Você vai para o checkout seguro do Stripe, onde pode usar o cartão já salvo no seu plano ou adicionar outro. O cartão nunca passa pela RYCS.
              </div>
            )}
          </div>

          {valor >= piso && (
            <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "var(--muted)" }}>Valor depositado</span><b>{fmt(valor)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--muted)" }}>Taxa de gateway</span><b>{fmt(0)}</b></div>
              <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 700 }}>Saldo creditado</span><b style={{ color: "var(--brand)" }}>{fmt(valor)}</b></div>
            </div>
          )}

          <button
            className="vx-btn vx-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "11px 0", fontSize: 14 }}
            onClick={confirmar} disabled={enviando || !valor || valor < piso}
          >
            {enviando
              ? (metodo === "pix" ? "Gerando Pix…" : "Abrindo checkout…")
              : metodo === "pix"
                ? <><QrCode size={15} /> Continuar com Pix</>
                : <><CreditCard size={15} /> Continuar com cartão</>}
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

// ── Componente principal ──────────────────────────────────────────────────────
export default function PagamentosEmpresa({ emp, db, up, aviso, recarregar, secao = "plano", onTrocarSecao }) {
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

  const planoAtual = emp.assinatura || null;
  const infPlano   = planoAtual ? PLANOS[planoAtual] : null;
  const premium    = isPremium(emp);
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
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>Assine um plano para começar a usar a RYCS.</span>
        </div>
      )}


      {secao === "plano" && <>
      {/* ── Planos disponíveis ── */}
      <div style={{ marginBottom: 24 }}>
        <PlanosEmpresa aviso={aviso} recarregar={recarregar} />
      </div>
      {/* Destaque da empresa agora fica em Pagamentos › Visibilidade (página própria). */}
      </>}

      {secao === "campanhas" && (
        <CentralPagamentosCampanhas
          emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar}
          dados={dados} carregando={carregando}
          onAdicionarSaldo={() => setModalSaldo(true)}
        />
      )}

      {secao === "movimentacoes" && <>
      {/* ── 2. Saldo operacional ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 4 }}>Saldo operacional</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)", fontVariantNumeric: "tabular-nums", letterSpacing: -0.8 }}>
              {carregando ? "—" : money(posicao.disponivel)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Disponível para remunerar profissionais</div>
          </div>
          <button className="vx-btn vx-btn-primary" onClick={() => setModalSaldo(true)}>
            <Plus size={14} /> Adicionar saldo
          </button>
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
