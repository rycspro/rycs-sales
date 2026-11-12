import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Check, CheckCheck, ChevronRight, CircleAlert, Clock3,
  LockKeyhole, MapPin, Megaphone, Search, Settings2, ShieldCheck,
  Users, Wallet, X, Zap,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";

// ── Catálogo de movimentos / status (mesma linguagem do restante da página) ────
const MOV = {
  deposito:        { nome: "Depósito via Pix",    entrada: true },
  reserva:         { nome: "Reserva de saldo",    interna: true },
  estorno_reserva: { nome: "Liberação de reserva",interna: true },
  liquidacao:      { nome: "Pagamento de tarefa", entrada: false },
};

const STATUS_MOV = {
  confirmado:  { label: "Concluído",   bg: "var(--brand-50)",  color: "var(--brand)" },
  pendente:    { label: "Pendente",    bg: "var(--amber-50)",  color: "var(--amber)" },
  processando: { label: "Processando", bg: "var(--brand-50)",  color: "var(--brand)" },
  recusado:    { label: "Falhou",      bg: "var(--red-50)",    color: "var(--red)" },
};

// Status da submissão → coluna de pagamento da campanha.
const PAG_STATUS = {
  analisando:  { label: "Em análise",  grupo: "pendentes",  bg: "var(--surface-2)", color: "var(--muted)" },
  ia_aprovado: { label: "Aguardando aprovação", grupo: "pendentes", bg: "var(--amber-50)", color: "var(--amber)" },
  revisao:     { label: "Aguardando aprovação", grupo: "pendentes", bg: "var(--amber-50)", color: "var(--amber)" },
  conferido:   { label: "Aprovado",    grupo: "aprovados",  bg: "var(--brand-50)",  color: "var(--brand)" },
  liberado:    { label: "Pago",        grupo: "pagos",      bg: "var(--brand-50)",  color: "var(--brand)" },
  ia_recusado: { label: "Bloqueado",   grupo: "bloqueados", bg: "var(--red-50)",    color: "var(--red)" },
  recusado:    { label: "Bloqueado",   grupo: "bloqueados", bg: "var(--red-50)",    color: "var(--red)" },
};

const PENDENTE_APROVACAO = ["revisao", "ia_aprovado"];
const EM_ABERTO = ["analisando", "ia_aprovado", "revisao", "conferido"];

const iniciais = (nome = "") =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "PR";

function StatusPill({ status = "confirmado" }) {
  const cfg = STATUS_MOV[status] || STATUS_MOV.confirmado;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: cfg.bg, color: cfg.color, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

// ── Indicador financeiro compacto ─────────────────────────────────────────────
function Indicador({ label, valor, sub, Icon, tone = "ink" }) {
  const cor = { ink: "var(--ink)", amber: "var(--amber)", brand: "var(--brand)" }[tone];
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "15px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <Icon size={15} strokeWidth={2} color="var(--muted)" aria-hidden="true" />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor, fontVariantNumeric: "tabular-nums", letterSpacing: -0.4 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Painel lateral direito genérico ───────────────────────────────────────────
function Drawer({ titulo, subtitulo, status, onFechar, children, rodape }) {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onFechar]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(17,24,39,.28)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div
        className="vx-fade"
        style={{ width: "min(460px, 100%)", height: "100%", background: "var(--surface-solid)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 44px rgba(17,24,39,.14)", display: "flex", flexDirection: "column" }}
        role="dialog" aria-modal="true"
      >
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {subtitulo && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>{subtitulo}</div>}
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", letterSpacing: -0.3, overflow: "hidden", textOverflow: "ellipsis" }}>{titulo}</div>
            {status && <div style={{ marginTop: 6 }}>{status}</div>}
          </div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, flexShrink: 0 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>{children}</div>
        {rodape && <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)" }}>{rodape}</div>}
      </div>
    </div>
  );
}

// ── Painel: gerenciar pagamentos de uma campanha ──────────────────────────────
function PagamentosDrawer({ campanha, submissions, db, up, aviso, recarregar, onFechar }) {
  const [filtro, setFiltro] = useState("todos");
  const [confirmar, setConfirmar] = useState(null); // { id, acao }
  const [processando, setProcessando] = useState(false);

  const itens = useMemo(
    () => submissions
      .filter((s) => s.campaignId === campanha.id)
      .sort((a, b) => Number(b.criadoEm) - Number(a.criadoEm)),
    [submissions, campanha.id],
  );

  const filtros = [
    ["todos", "Todos"], ["pendentes", "Pendentes"], ["aprovados", "Aprovados"],
    ["pagos", "Pagos"], ["bloqueados", "Bloqueados"],
  ];
  const visiveis = filtro === "todos"
    ? itens
    : itens.filter((s) => (PAG_STATUS[s.status]?.grupo) === filtro);

  const pago = itens.filter((s) => s.status === "liberado").reduce((a, s) => a + Number(s.valor || 0), 0);
  const emAberto = itens.filter((s) => EM_ABERTO.includes(s.status)).reduce((a, s) => a + Number(s.valor || 0), 0);

  const executar = async (sub, acao) => {
    setProcessando(true);
    const novo = acao === "aprovar"
      ? { status: "conferido", motivo: "Pagamento aprovado pela empresa." }
      : { status: "recusado", motivo: "Pagamento bloqueado pela empresa." };
    const r = await apiPatch(`/submissions/${sub.id}`, novo);
    setProcessando(false);
    setConfirmar(null);
    if (!r || r.error) return aviso(r?.error || "Não foi possível concluir a operação.");
    up((d) => ({ submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, ...novo } : s) }));
    recarregar?.();
    aviso(acao === "aprovar" ? "Pagamento aprovado." : "Pagamento bloqueado.");
  };

  return (
    <Drawer
      subtitulo="Pagamentos da campanha"
      titulo={campanha.titulo}
      status={
        <span className={`vx-campaign-status is-${campanha.status}`} style={{ fontSize: 11 }}>{campanha.status}</span>
      }
      onFechar={onFechar}
    >
      {/* resumo compacto */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "11px 13px" }}>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 3 }}>Em aberto</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--amber)", fontVariantNumeric: "tabular-nums" }}>{money(emAberto)}</div>
        </div>
        <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "11px 13px" }}>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 3 }}>Pago</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>{money(pago)}</div>
        </div>
      </div>

      <div className="vx-seg" style={{ marginBottom: 14, width: "100%" }}>
        {filtros.map(([k, label]) => (
          <button key={k} data-on={filtro === k ? "1" : "0"} onClick={() => setFiltro(k)}>{label}</button>
        ))}
      </div>

      {!visiveis.length && (
        <div style={{ textAlign: "center", padding: "30px 16px", color: "var(--muted)" }}>
          <Wallet size={24} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>Nenhum pagamento {filtro !== "todos" ? "neste filtro" : "nesta campanha"}.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visiveis.map((sub) => {
          const seller = db.sellers.find((s) => s.id === sub.sellerId);
          const cfg = PAG_STATUS[sub.status] || { label: sub.status, bg: "var(--surface-2)", color: "var(--muted)" };
          const pendente = PENDENTE_APROVACAO.includes(sub.status);
          const emConfirmacao = confirmar?.id === sub.id;
          return (
            <div key={sub.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 13px", background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--brand-50)", color: "var(--brand)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {iniciais(seller?.nome)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seller?.nome || "Profissional"}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{ACOES[sub.tipo]?.nome || sub.tipo} · {dataCurta(sub.criadoEm)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{money(sub.valor)}</div>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>

              {pendente && !emConfirmacao && (
                <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                  <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ flex: 1, justifyContent: "center" }} disabled={processando}
                    onClick={() => setConfirmar({ id: sub.id, acao: "aprovar" })}><Check size={13} /> Aprovar</button>
                  <button className="vx-btn vx-btn-danger vx-btn-sm" style={{ flex: 1, justifyContent: "center" }} disabled={processando}
                    onClick={() => setConfirmar({ id: sub.id, acao: "bloquear" })}>Bloquear</button>
                </div>
              )}

              {emConfirmacao && (
                <div style={{ marginTop: 11, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 10 }}>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 9 }}>
                    {confirmar.acao === "aprovar"
                      ? <>Aprovar <b>{money(sub.valor)}</b> para {seller?.nome || "o profissional"}? O valor segue para repasse.</>
                      : <>Bloquear este pagamento de <b>{money(sub.valor)}</b>? A reserva é liberada de volta ao caixa.</>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={`vx-btn vx-btn-sm ${confirmar.acao === "aprovar" ? "vx-btn-primary" : "vx-btn-danger"}`} style={{ flex: 1, justifyContent: "center" }}
                      disabled={processando} onClick={() => executar(sub, confirmar.acao)}>
                      {processando ? "Processando…" : "Confirmar"}
                    </button>
                    <button className="vx-btn vx-btn-sm" style={{ flex: 1, justifyContent: "center" }} disabled={processando} onClick={() => setConfirmar(null)}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

// ── Painel: saldo da campanha (consulta) ──────────────────────────────────────
function SaldoDrawer({ campanha, submissions, onFechar, onAdicionarSaldo }) {
  const itens = submissions.filter((s) => s.campaignId === campanha.id);
  const pago = itens.filter((s) => s.status === "liberado").reduce((a, s) => a + Number(s.valor || 0), 0);
  const reservado = itens.filter((s) => EM_ABERTO.includes(s.status)).reduce((a, s) => a + Number(s.valor || 0), 0);
  const orcamento = Number(campanha.orcamento || 0);
  const restante = orcamento > 0 ? Math.max(0, orcamento - pago - reservado) : null;

  const linha = (label, valor, cor) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
      <b style={{ fontSize: 14, color: cor || "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{valor}</b>
    </div>
  );

  return (
    <Drawer
      subtitulo="Saldo da campanha"
      titulo={campanha.titulo}
      status={<span className={`vx-campaign-status is-${campanha.status}`} style={{ fontSize: 11 }}>{campanha.status}</span>}
      onFechar={onFechar}
      rodape={
        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ justifyContent: "center" }} onClick={() => { onFechar(); onAdicionarSaldo?.(); }}>
          <Wallet size={15} /> Adicionar saldo ao caixa
        </button>
      }
    >
      <div style={{ marginBottom: 16 }}>
        {linha("Orçamento planejado", orcamento > 0 ? money(orcamento) : "Sem limite")}
        {linha("Reservado em tarefas", money(reservado), "var(--amber)")}
        {linha("Total pago", money(pago), "var(--brand)")}
        {restante != null && linha("Orçamento restante", money(restante))}
      </div>
      <div className="vx-notice" style={{ display: "flex", gap: 8 }}>
        <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          O caixa é único para toda a empresa. Os valores acima mostram o que esta campanha já comprometeu e pagou — o saldo disponível para novos pagamentos é compartilhado entre as campanhas.
        </span>
      </div>
    </Drawer>
  );
}

// ── Card de campanha ──────────────────────────────────────────────────────────
function CampanhaCard({ campanha, submissions, onPagamentos, onSaldo }) {
  const itens = submissions.filter((s) => s.campaignId === campanha.id);
  const pago = itens.filter((s) => s.status === "liberado").reduce((a, s) => a + Number(s.valor || 0), 0);
  const reservado = itens.filter((s) => EM_ABERTO.includes(s.status)).reduce((a, s) => a + Number(s.valor || 0), 0);
  const orcamento = Number(campanha.orcamento || 0);

  const fin = (label, valor, cor) => (
    <div style={{ flex: 1, minWidth: 92 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: cor || "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{valor}</div>
    </div>
  );

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 13 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campanha.titulo}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            {campanha.regiao && <span style={{ fontSize: 11.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {campanha.regiao}</span>}
            <span style={{ fontSize: 11.5, color: campanha.candidaturasAbertas === false ? "var(--muted)" : "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Users size={12} /> {campanha.candidaturasAbertas === false ? "Candidaturas encerradas" : "Candidaturas abertas"}
            </span>
          </div>
        </div>
        <span className={`vx-campaign-status is-${campanha.status}`} style={{ fontSize: 11, flexShrink: 0 }}>{campanha.status}</span>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        {fin("Orçamento", orcamento > 0 ? money(orcamento) : "Sem limite")}
        {fin("Reservado", money(reservado), "var(--amber)")}
        {fin("Pago", money(pago), "var(--brand)")}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ flex: 1, justifyContent: "center", minWidth: 150 }} onClick={onPagamentos}>
          Gerenciar pagamentos
        </button>
        <button className="vx-btn vx-btn-sm" style={{ flex: 1, justifyContent: "center", minWidth: 120 }} onClick={onSaldo}>
          Gerenciar saldo
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CentralPagamentosCampanhas({ emp, db, up, aviso, recarregar, dados, carregando, onAdicionarSaldo }) {
  const posicao = dados?.posicao || { saldo: 0, reservado: 0, disponivel: 0 };
  const extrato = dados?.extrato || [];

  const campanhas = useMemo(() => (db.campaigns || []).filter((c) => c.companyId === emp.id), [db.campaigns, emp.id]);
  const submissions = useMemo(() => (db.submissions || []).filter((s) => s.companyId === emp.id), [db.submissions, emp.id]);

  const ativas = campanhas.filter((c) => c.status === "ativa");
  const totalPago = submissions.filter((s) => s.status === "liberado").reduce((a, s) => a + Number(s.valor || 0), 0);
  const pendentesAprovacao = submissions.filter((s) => PENDENTE_APROVACAO.includes(s.status));
  const aguardando = pendentesAprovacao.reduce((a, s) => a + Number(s.valor || 0), 0);

  // Modo de liberação (persistido em /company/approval-rules → regras.ativo).
  const [regras, setRegras] = useState(null);
  const [salvandoModo, setSalvandoModo] = useState(false);
  useEffect(() => {
    api("/company/approval-rules").then((r) => { if (r && !r.error) setRegras(r.regras); });
  }, []);
  const modo = regras ? (regras.ativo ? "auto" : "manual") : null;

  const selecionarModo = async (novoAtivo) => {
    if (!regras || regras.ativo === novoAtivo || salvandoModo) return;
    const anterior = regras;
    setSalvandoModo(true);
    setRegras({ ...regras, ativo: novoAtivo }); // otimista
    const r = await apiPatch("/company/approval-rules", { ...regras, ativo: novoAtivo });
    setSalvandoModo(false);
    if (!r || r.error) { setRegras(anterior); return aviso(r?.error || "Não foi possível salvar o modo de liberação."); }
    setRegras(r.regras);
    aviso(novoAtivo ? "Liberação automática ativada." : "Modo de aprovação manual ativado.");
  };

  // Busca de campanhas (só aparece quando há muitas).
  const [busca, setBusca] = useState("");
  const campanhasFiltradas = busca.trim()
    ? campanhas.filter((c) => (c.titulo || "").toLowerCase().includes(busca.trim().toLowerCase()))
    : campanhas;

  const [verTudo, setVerTudo] = useState(false);
  const [drawerPag, setDrawerPag] = useState(null);
  const [drawerSaldo, setDrawerSaldo] = useState(null);

  const movimentos = verTudo ? extrato : extrato.slice(0, 5);
  const saldoBaixo = aguardando > 0 && posicao.disponivel < aguardando;

  return (
    <div className="vx-fade">
      {/* ── Cabeçalho ── */}
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Financeiro comercial</div>
          <h1 className="vx-disp">Pagamentos das Campanhas</h1>
          <p>Gerencie seus saldos e pagamentos aos profissionais.</p>
        </div>
      </div>

      {/* ── Alerta de saldo insuficiente ── */}
      {saldoBaixo && (
        <div className="vx-notice vx-notice-amber" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <CircleAlert size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 180 }}>Seu saldo pode ser insuficiente para os próximos pagamentos.</span>
          <button className="vx-btn vx-btn-sm" onClick={() => onAdicionarSaldo?.()}>Adicionar saldo</button>
        </div>
      )}

      {/* ── Linha 1: saldo disponível + liberação ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>
        {/* Card saldo disponível */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)" }}>Saldo disponível</span>
            <Wallet size={18} color="var(--muted)" strokeWidth={1.8} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "var(--brand)", fontVariantNumeric: "tabular-nums", letterSpacing: -0.8, marginTop: 10 }}>
            {carregando ? "—" : money(posicao.disponivel)}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, flex: 1 }}>Disponível para novas liberações</div>
          <button className="vx-btn vx-btn-primary" style={{ marginTop: 16, justifyContent: "center" }} onClick={() => onAdicionarSaldo?.()}>
            <Wallet size={15} /> Adicionar saldo
          </button>
        </div>

        {/* Card liberação de pagamentos */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)" }}>Liberação de pagamentos</span>
            {salvandoModo && <span style={{ fontSize: 11, color: "var(--muted)" }}>Salvando…</span>}
          </div>

          {!regras ? (
            <div className="vx-skeleton" style={{ height: 112, borderRadius: 12 }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { key: "auto", ativo: true, titulo: "Automática", Icon: Zap, desc: "Pagamentos liberados automaticamente após a validação das tarefas.", recomendado: true },
                { key: "manual", ativo: false, titulo: "Aprovação manual", Icon: ShieldCheck, desc: "Você analisa e aprova os pagamentos antes da liberação." },
              ].map(({ key, ativo, titulo, Icon, desc, recomendado }) => {
                const on = modo === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selecionarModo(ativo)}
                    disabled={salvandoModo}
                    aria-pressed={on}
                    style={{
                      position: "relative",
                      display: "flex", gap: 11, textAlign: "left", cursor: salvandoModo ? "default" : "pointer",
                      padding: "11px 13px", borderRadius: 11, background: on ? "var(--brand-50)" : "var(--surface)",
                      border: `1.5px solid ${on ? "var(--brand)" : "var(--border)"}`, transition: "border-color .15s, background .15s",
                    }}
                  >
                    {recomendado && (
                      <span style={{
                        position: "absolute", top: 10, right: 10,
                        fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
                        padding: "2px 7px", borderRadius: 20,
                        background: "var(--brand)", color: "#fff",
                      }}>Recomendado</span>
                    )}
                    <span style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${on ? "var(--brand)" : "var(--border-strong)"}`, background: on ? "var(--brand)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                      {on && <Check size={11} color="#fff" strokeWidth={3} />}
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: on ? "var(--brand)" : "var(--ink)" }}>
                        <Icon size={14} /> {titulo}
                      </span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{desc}</span>
                    </span>
                  </button>
                );
              })}
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                {modo === "manual"
                  ? `Modo manual ativo${pendentesAprovacao.length ? ` · ${pendentesAprovacao.length} aguardando sua aprovação` : ""}`
                  : "Modo automático ativo"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Linha 2: indicadores financeiros ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Indicador label="Saldo reservado" valor={carregando ? "—" : money(posicao.reservado)} sub="Comprometido com tarefas" Icon={LockKeyhole} tone="amber" />
        <Indicador label="Aguardando aprovação" valor={money(aguardando)} sub={`${pendentesAprovacao.length} pagamento${pendentesAprovacao.length !== 1 ? "s" : ""} pendente${pendentesAprovacao.length !== 1 ? "s" : ""}`} Icon={Clock3} tone="ink" />
        <Indicador label="Total pago" valor={money(totalPago)} sub="Pagamentos concluídos" Icon={CheckCheck} tone="brand" />
      </div>

      {/* ── Linha 3: campanhas ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 className="vx-disp" style={{ fontSize: 19, margin: 0 }}>Campanhas</h2>
            {ativas.length > 0 && <span className="vx-chip" style={{ fontSize: 11 }}>{ativas.length} ativa{ativas.length > 1 ? "s" : ""}</span>}
          </div>
          {campanhas.length > 6 && (
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar campanha"
                style={{ paddingLeft: 30, fontSize: 12.5, height: "auto", padding: "7px 10px 7px 30px", maxWidth: 220 }} />
            </div>
          )}
        </div>

        {!campanhas.length ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <Megaphone size={26} color="var(--muted)" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Nenhuma campanha criada</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Crie uma campanha para vincular recursos financeiros e pagar os profissionais.</p>
          </div>
        ) : !campanhasFiltradas.length ? (
          <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--muted)", fontSize: 13 }}>Nenhuma campanha encontrada para “{busca}”.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {campanhasFiltradas.map((c) => (
              <CampanhaCard key={c.id} campanha={c} submissions={submissions}
                onPagamentos={() => setDrawerPag(c)} onSaldo={() => setDrawerSaldo(c)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Linha 4: últimas movimentações ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 className="vx-disp" style={{ fontSize: 19, margin: 0 }}>Últimas movimentações</h2>
        </div>

        {carregando ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            {[0, 1, 2].map((i) => <div key={i} className="vx-skeleton" style={{ height: 16, marginBottom: 10, borderRadius: 6 }} />)}
          </div>
        ) : !extrato.length ? (
          <div style={{ textAlign: "center", padding: "32px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Nenhuma movimentação</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Depósitos e pagamentos a profissionais aparecerão aqui.</p>
          </div>
        ) : (
          <>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Movimentação", "Data", "Valor", "Status"].map((h) => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: h === "Valor" ? "right" : "left", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movimentos.map((l, i) => {
                      const m = MOV[l.tipo] || { nome: l.tipo };
                      const interna = m.interna;
                      const entrada = m.entrada;
                      const sinal = interna ? "" : (l.valor < 0 || entrada === false ? "−" : "+");
                      const corValor = interna ? "var(--muted)" : (entrada ? "var(--brand)" : "var(--red)");
                      const st = l.tipo === "deposito" ? (l.status || "confirmado") : "confirmado";
                      return (
                        <tr key={l.id || i} style={{ borderBottom: i < movimentos.length - 1 ? "1px solid var(--border)" : "none" }}>
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 12.5 }}>{m.nome}</div>
                            {(l.campanha || l.profissional) && (
                              <div style={{ fontSize: 11, color: "var(--muted)" }}>{[l.campanha, l.profissional].filter(Boolean).join(" · ")}</div>
                            )}
                          </td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>{dataCurta(l.criadoEm)}</td>
                          <td style={{ padding: "11px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: corValor, whiteSpace: "nowrap" }}>
                            {sinal}{money(Math.abs(l.valor))}
                          </td>
                          <td style={{ padding: "11px 14px" }}><StatusPill status={st} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {extrato.length > 5 && (
              <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginTop: 10 }} onClick={() => setVerTudo((v) => !v)}>
                {verTudo ? "Mostrar menos" : "Ver histórico completo"} <ChevronRight size={13} style={{ transform: verTudo ? "rotate(90deg)" : "none", transition: ".15s" }} />
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Painéis laterais ── */}
      {drawerPag && (
        <PagamentosDrawer campanha={drawerPag} submissions={submissions} db={db} up={up} aviso={aviso}
          recarregar={recarregar} onFechar={() => setDrawerPag(null)} />
      )}
      {drawerSaldo && (
        <SaldoDrawer campanha={drawerSaldo} submissions={submissions} onFechar={() => setDrawerSaldo(null)}
          onAdicionarSaldo={onAdicionarSaldo} />
      )}
    </div>
  );
}
