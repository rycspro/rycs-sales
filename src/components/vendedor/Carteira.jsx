import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Clock, Banknote, CheckCircle2, Eye, EyeOff, ArrowUpRight, ArrowDownLeft,
  X, Info, Loader, ChevronRight, ShieldCheck, Sparkles, Filter,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { SAQUE_MINIMO } from "../../../shared/saque.js";

const AZUL = "#318CE7";
const TIPO_LABEL = { agendamento: "Reunião agendada", realizada: "Visita realizada", venda: "Venda fechada", lead: "Lead gerado", contato: "Contato", ligacao: "Ligação", follow: "Follow-up", visita: "Visita" };

// Rótulos dos estados de saque (mesma semântica do backend; nada é recalculado).
const SITUACAO_SAQUE = {
  pago: { texto: "Pago", cor: "#16A34A", bg: "#16A34A14" },
  solicitado: { texto: "Processando", cor: "#B45309", bg: "#B4530914" },
  falhou: { texto: "Devolvido ao saldo", cor: "var(--muted)", bg: "var(--surface-2)" },
  cancelado: { texto: "Devolvido ao saldo", cor: "var(--muted)", bg: "var(--surface-2)" },
};

const TIPOS_CHAVE = [
  { v: "CPF", label: "CPF", ph: "000.000.000-00" },
  { v: "CNPJ", label: "CNPJ", ph: "00.000.000/0001-00" },
  { v: "PHONE", label: "Celular", ph: "(11) 90000-0000" },
  { v: "EMAIL", label: "E-mail", ph: "voce@email.com" },
  { v: "EVP", label: "Chave aleatória", ph: "chave aleatória do banco" },
];

// Mascara a chave PIX para a etapa de revisão — mostra o suficiente para
// reconhecer, sem expor a chave inteira.
function mascararChave(tipo, chave) {
  const c = String(chave || "").trim();
  if (!c) return "—";
  if (tipo === "EMAIL") {
    const [u, d] = c.split("@");
    if (!d) return c;
    return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
  }
  const limpo = c.replace(/\s/g, "");
  if (limpo.length <= 4) return limpo;
  return `${"•".repeat(Math.max(2, limpo.length - 4))}${limpo.slice(-4)}`;
}

function Tooltip({ texto }) {
  return (
    <span title={texto} style={{ display: "inline-flex", cursor: "help", color: "var(--muted-2, #9AA6B4)" }} aria-label={texto}>
      <Info size={13} />
    </span>
  );
}

// ── Modal de saque (3 etapas): dados → revisão → confirmação ──────────────────
function ModalSaque({ eu, min, moeda, onFechar, onConcluir, aviso }) {
  const [etapa, setEtapa] = useState("dados"); // dados | revisao | enviando | resultado
  const [pix, setPix] = useState(eu.pix || "");
  const [pixTipo, setPixTipo] = useState(eu.pixTipo || "");
  const [valor, setValor] = useState("");
  const [resultado, setResultado] = useState(null);

  const v = Number(String(valor).replace(",", "."));
  const disponivel = Number(eu.disponivel) || 0;

  const irRevisar = () => {
    if (!pixTipo) return aviso("Escolha o tipo da sua chave Pix.");
    if (!pix.trim()) return aviso("Informe a chave PIX.");
    if (!v || v < min) return aviso(`Saque mínimo de ${money(min, moeda)}.`);
    if (v > disponivel) return aviso("Valor maior que o saldo disponível.");
    setEtapa("revisao");
  };

  // Mesma lógica de sempre: se a chave mudou, atualiza o cadastro; depois o
  // servidor debita o saldo e dispara o Pix numa transação. O cliente nunca
  // decide autorização nem envia saldo/destino.
  const confirmar = async () => {
    setEtapa("enviando");
    if (pix.trim() !== (eu.pix || "") || pixTipo !== (eu.pixTipo || "")) {
      const r = await apiPatch(`/sellers/${eu.id}`, { pix: pix.trim(), pixTipo });
      if (r?.error) { setEtapa("revisao"); return aviso(r.error); }
    }
    const r = await api("/payments/withdraw", { valor: v });
    if (!r || r.error) { setEtapa("revisao"); return aviso(r?.error || "Não foi possível solicitar o saque."); }
    setResultado(r);
    setEtapa("resultado");
    onConcluir?.();
  };

  const tipoLabel = TIPOS_CHAVE.find((t) => t.v === pixTipo)?.label || pixTipo;

  return (
    <div className="vx-overlay" onClick={onFechar} role="dialog" aria-modal="true" aria-label="Sacar dinheiro" style={{ zIndex: 1200 }}>
      <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: "94vw" }}>
        <div className="vx-row" style={{ marginBottom: 16 }}>
          <div>
            <div className="vx-eyebrow">Saque via PIX</div>
            <h2 className="vx-disp" style={{ margin: "3px 0", fontSize: 19 }}>Sacar dinheiro</h2>
          </div>
          <button className="vx-btn vx-btn-ghost" onClick={onFechar} aria-label="Fechar"><X size={16} /></button>
        </div>

        {/* Passos */}
        {etapa !== "resultado" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {["Dados", "Revisão", "Confirmação"].map((nome, i) => {
              const idx = { dados: 0, revisao: 1, enviando: 2 }[etapa] ?? 0;
              const on = i <= idx;
              return (
                <div key={nome} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 4, borderRadius: 999, background: on ? AZUL : "var(--border)" }} />
                  <div style={{ fontSize: 10.5, marginTop: 5, color: on ? AZUL : "var(--muted)", fontWeight: on ? 600 : 500 }}>{nome}</div>
                </div>
              );
            })}
          </div>
        )}

        {etapa === "dados" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", marginBottom: 16, fontSize: 13.5 }}>
              <span className="vx-mut">Saldo disponível</span>
              <b className="vx-mono">{money(disponivel, moeda)}</b>
            </div>
            <label style={{ display: "block", marginBottom: 12 }}>
              <div className="vx-label">Tipo da chave</div>
              <select className="vx-input" value={pixTipo} onChange={(e) => setPixTipo(e.target.value)}>
                <option value="">Selecione…</option>
                {TIPOS_CHAVE.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </label>
            <label style={{ display: "block", marginBottom: 12 }}>
              <div className="vx-label">Chave PIX</div>
              <input className="vx-input" value={pix} onChange={(e) => setPix(e.target.value)}
                placeholder={TIPOS_CHAVE.find((t) => t.v === pixTipo)?.ph || "Escolha o tipo primeiro"} />
            </label>
            <label style={{ display: "block", marginBottom: 6 }}>
              <div className="vx-label">Valor a sacar (mínimo {money(min, moeda)})</div>
              <input className="vx-input vx-mono" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </label>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 16 }} onClick={() => setValor(String(disponivel).replace(".", ","))}>Usar saldo total</button>
            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ background: AZUL, borderColor: AZUL }} onClick={irRevisar}>
              Revisar saque <ChevronRight size={15} />
            </button>
          </>
        )}

        {etapa === "revisao" && (
          <>
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
              {[
                ["Tipo de chave", tipoLabel],
                ["Chave PIX", mascararChave(pixTipo, pix)],
                ["Valor solicitado", money(v, moeda)],
                ["Taxa", "Isento"],
                ["Valor líquido", money(v, moeda)],
              ].map(([k, val], i, arr) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", fontSize: 13.5, borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: k === "Valor líquido" ? "var(--surface-2)" : "transparent" }}>
                  <span className="vx-mut">{k}</span>
                  <b style={{ fontWeight: k === "Valor líquido" ? 800 : 600 }}>{val}</b>
                </div>
              ))}
            </div>
            <div className="vx-mut" style={{ display: "flex", gap: 7, fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
              <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              O valor é debitado do seu saldo e enviado pela nossa processadora de pagamentos. A confirmação aparece assim que o banco responder.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="vx-btn" style={{ flex: "0 0 auto" }} onClick={() => setEtapa("dados")}>Voltar</button>
              <button className="vx-btn vx-btn-primary" style={{ flex: 1, justifyContent: "center", background: AZUL, borderColor: AZUL }} onClick={confirmar}>Confirmar saque</button>
            </div>
          </>
        )}

        {etapa === "enviando" && (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <Loader size={30} color={AZUL} style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ marginTop: 14, fontWeight: 600 }}>Enviando sua solicitação…</div>
            <div className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>Não feche esta janela.</div>
          </div>
        )}

        {etapa === "resultado" && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: resultado?.status === "pago" ? "#DCFCE7" : "#E0F2FE", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              {resultado?.status === "pago" ? <CheckCircle2 size={34} color="#16A34A" /> : <Clock size={32} color={AZUL} />}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
              {resultado?.status === "pago" ? "Pix enviado!" : "Solicitação recebida"}
            </div>
            <div className="vx-mut" style={{ fontSize: 13.5, marginBottom: 20, lineHeight: 1.5 }}>
              {resultado?.message || (resultado?.status === "pago" ? "O valor já está na sua conta." : "Sua transferência está em processamento.")}
            </div>
            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ background: AZUL, borderColor: AZUL }} onClick={onFechar}>Concluir</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Carteira({ eu, db, aviso, recarregar, setAba }) {
  const moeda = "BRL"; // liquidação PIX é sempre em reais
  const [oculto, setOculto] = useState(false);
  const [modal, setModal] = useState(false);
  const [MIN, setMin] = useState(SAQUE_MINIMO);
  const [tab, setTab] = useState("todas");
  const [fStatus, setFStatus] = useState("");
  const [fPeriodo, setFPeriodo] = useState("90");
  const [limite, setLimite] = useState(12);

  useEffect(() => {
    api("/profissional/plano").then((r) => { if (r && Number.isFinite(r.saqueMinimo)) setMin(r.saqueMinimo); });
  }, []);

  const fmt = (v) => (oculto ? "••••••" : money(v, moeda));
  const disponivel = Number(eu.disponivel) || 0;
  const podeSacar = disponivel >= MIN;

  const aprovadas = (db.submissions || []).filter((s) => s.sellerId === eu.id && s.status === "liberado");
  const saques = (db.withdrawals || []).filter((w) => w.sellerId === eu.id);

  // Movimentações reais, sem duplicar valores: cada ganho aprovado é uma
  // entrada; cada saque é uma saída. Nada é inventado nem recalculado.
  const movimentos = useMemo(() => {
    const ganhos = aprovadas.map((s) => ({
      id: "g" + s.id, tipo: "ganho", valor: Number(s.liquido ?? s.valor) || 0, data: s.reviewedEm || s.criadoEm,
      empresa: (db.companies || []).find((c) => c.id === s.companyId)?.nome || "",
      campanha: (db.campaigns || []).find((c) => c.id === s.campaignId)?.titulo || "",
      descricao: TIPO_LABEL[s.tipo] || "Ação aprovada", status: "liberado",
    }));
    const saida = saques.map((w) => ({
      id: "s" + w.id, tipo: "saque", valor: -(Number(w.valor) || 0), data: w.criadoEm,
      descricao: "Saque via PIX", chave: w.pix, status: w.status,
    }));
    return [...ganhos, ...saida].sort((a, b) => (b.data || 0) - (a.data || 0));
  }, [aprovadas, saques, db.companies, db.campaigns]);

  const filtrados = useMemo(() => {
    const agora = Date.now();
    const janela = fPeriodo === "tudo" ? Infinity : Number(fPeriodo) * 86400000;
    return movimentos.filter((m) => {
      if (tab === "ganhos" && m.tipo !== "ganho") return false;
      if (tab === "saques" && m.tipo !== "saque") return false;
      if (fPeriodo !== "tudo" && (agora - (m.data || 0)) > janela) return false;
      if (fStatus && m.status !== fStatus) return false;
      return true;
    });
  }, [movimentos, tab, fPeriodo, fStatus]);

  const visiveis = filtrados.slice(0, limite);
  useEffect(() => { setLimite(12); }, [tab, fStatus, fPeriodo]);

  const INDIC = [
    { label: "Em análise", valor: eu.pendente, Icon: Clock, cor: "#B45309", dica: "Ganhos de ações enviadas que ainda aguardam aprovação da empresa. Entram no saldo disponível quando aprovados." },
    { label: "Já sacado", valor: eu.sacado, Icon: Banknote, cor: "#4338CA", dica: "Total que você já retirou da carteira em saques concluídos." },
  ];

  const temMovimento = movimentos.length > 0;

  return (
    <div className="vx-fade">
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 4 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "#EAF4FF", color: AZUL, flexShrink: 0 }}><Wallet size={20} /></span>
        <h1 className="vx-disp" style={{ fontSize: 23, margin: 0, letterSpacing: -0.4 }}>Minha Carteira</h1>
      </div>
      <p style={{ margin: "0 0 18px 47px", color: "var(--muted)", fontSize: 13.5 }}>Acompanhe seus ganhos, saldos e retiradas em um só lugar.</p>

      {/* Card principal — saldo disponível */}
      <div className="vx-card" style={{ padding: 0, overflow: "hidden", marginBottom: 14, border: `1px solid ${AZUL}33` }}>
        <div style={{ padding: "22px 24px", background: `linear-gradient(135deg, ${AZUL} 0%, #2563EB 100%)`, color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", opacity: 0.9 }}>Saldo disponível</span>
            <button type="button" onClick={() => setOculto((o) => !o)} aria-label={oculto ? "Mostrar valores" : "Ocultar valores"}
              style={{ border: "none", background: "rgba(255,255,255,.18)", color: "#fff", width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer" }}>
              {oculto ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, margin: "8px 0 2px", fontVariantNumeric: "tabular-nums" }}>{fmt(disponivel)}</div>
          <div style={{ fontSize: 12.5, opacity: 0.85 }}>{moeda} · atualizado em tempo real</div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {podeSacar
              ? <>Saque mínimo de <b style={{ color: "var(--ink)" }}>{money(MIN, moeda)}</b></>
              : <>Faltam <b style={{ color: AZUL }}>{money(Math.max(0, MIN - disponivel), moeda)}</b> para o saque mínimo de {money(MIN, moeda)}</>}
          </div>
          <button className="vx-btn vx-btn-primary" disabled={!podeSacar} onClick={() => setModal(true)}
            style={podeSacar ? { background: AZUL, borderColor: AZUL, gap: 7 } : { gap: 7 }}>
            <ArrowUpRight size={16} /> Sacar dinheiro
          </button>
        </div>
      </div>

      {/* Indicadores secundários */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 12, marginBottom: 24 }}>
        {INDIC.map(({ label, valor, Icon, cor, dica }) => (
          <div key={label} className="vx-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: cor + "14", color: cor, flexShrink: 0 }}><Icon size={16} /></span>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{label}</span>
              <Tooltip texto={dica} />
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)", letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>{fmt(valor)}</div>
          </div>
        ))}
        <div className="vx-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "#16A34A14", color: "#16A34A", flexShrink: 0 }}><CheckCircle2 size={16} /></span>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>Ações aprovadas</span>
            <Tooltip texto="Quantidade de ações suas que já foram aprovadas e geraram ganhos." />
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)", letterSpacing: -0.5 }}>{aprovadas.length}</div>
        </div>
      </div>

      {/* Minhas movimentações */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Minhas movimentações</h2>
      </div>

      {!temMovimento ? (
        <div className="vx-card" style={{ padding: "44px 24px", textAlign: "center" }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, display: "grid", placeItems: "center", background: "#EAF4FF", color: AZUL, margin: "0 auto 16px" }}><Sparkles size={28} /></span>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Suas primeiras conquistas financeiras começam aqui.</div>
          <p className="vx-mut" style={{ fontSize: 13.5, maxWidth: 440, margin: "0 auto 18px", lineHeight: 1.55 }}>
            Quando suas atividades forem registradas e aprovadas, você poderá acompanhar os valores e movimentações nesta página.
          </p>
          <button className="vx-btn vx-btn-primary" style={{ background: AZUL, borderColor: AZUL, gap: 7 }} onClick={() => setAba?.("oportunidades")}>
            Explorar oportunidades <ChevronRight size={15} />
          </button>
        </div>
      ) : (
        <>
          {/* Abas + filtros */}
          <div className="vx-seg vx-subnav" style={{ marginBottom: 12 }}>
            {[["todas", "Todas"], ["ganhos", "Ganhos"], ["saques", "Saques"]].map(([k, l]) => (
              <button key={k} data-on={tab === k ? "1" : undefined} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <Filter size={14} color="var(--muted)" />
            <select className="vx-input" value={fPeriodo} onChange={(e) => setFPeriodo(e.target.value)} style={{ width: "auto", height: 34, fontSize: 12.5 }}>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="tudo">Todo o período</option>
            </select>
            <select className="vx-input" value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ width: "auto", height: 34, fontSize: 12.5 }}>
              <option value="">Todos os status</option>
              <option value="liberado">Recebido</option>
              <option value="pago">Saque pago</option>
              <option value="solicitado">Saque processando</option>
            </select>
          </div>

          {filtrados.length === 0 ? (
            <div className="vx-card" style={{ padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Nenhuma movimentação para os filtros escolhidos.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visiveis.map((m) => {
                const entrada = m.tipo === "ganho";
                const sit = !entrada ? (SITUACAO_SAQUE[m.status] || SITUACAO_SAQUE.solicitado) : { texto: "Recebido", cor: "#16A34A", bg: "#16A34A14" };
                return (
                  <div key={m.id} className="vx-card" style={{ padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, background: entrada ? "#16A34A12" : "#64748b14", color: entrada ? "#16A34A" : "#475569" }}>
                      {entrada ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descricao}</div>
                      <div className="vx-mut" style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {entrada ? [m.empresa, m.campanha].filter(Boolean).join(" · ") || dataCurta(m.data) : mascararChave("", m.chave)} · {dataCurta(m.data)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div className="vx-mono" style={{ fontSize: 14, fontWeight: 700, color: entrada ? "#16A34A" : "var(--ink)" }}>
                        {oculto ? "••••" : (entrada ? "+" : "−") + money(Math.abs(m.valor), moeda)}
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: sit.cor }}>{sit.texto}</span>
                    </div>
                  </div>
                );
              })}
              {filtrados.length > visiveis.length && (
                <button className="vx-btn vx-btn-block" style={{ marginTop: 4 }} onClick={() => setLimite((l) => l + 12)}>
                  Carregar mais ({filtrados.length - visiveis.length})
                </button>
              )}
            </div>
          )}
        </>
      )}

      {modal && (
        <ModalSaque eu={eu} min={MIN} moeda={moeda} aviso={aviso}
          onConcluir={() => recarregar?.()} onFechar={() => { setModal(false); recarregar?.(); }} />
      )}
    </div>
  );
}
