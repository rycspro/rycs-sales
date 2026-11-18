import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Check, Loader, QrCode, ShieldCheck, X, User, Zap, Gem, Crown,
  Layers, Wallet, MessageCircle, Mail, CalendarClock, Star, UserPlus, Megaphone,
  Sparkles, GraduationCap, MessagesSquare, Bot, Target, Send, Banknote,
} from "lucide-react";
import NumberFlow from "@number-flow/react";
import confetti from "canvas-confetti";
import { api, apiDelete } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { mascararDocumento } from "../../../shared/documentoConta.js";
import { PLANOS_PROFISSIONAL, ORDEM_PLANOS_PROFISSIONAL, CICLOS, mensalidadeProfissional, valorProfissionalNoCiclo } from "../../../shared/planosProfissional.js";
import { descontoDoCiclo } from "../../../shared/planos.js";

// Planos do profissional (Grátis/Pro/Premium), no mesmo template da vitrine de
// planos da empresa (PlanosEmpresa + PricingPlanos): faixa larga do plano
// gratuito, seletor mensal/semestral/anual com os mesmos descontos, cards com
// preço animado, checkout em janela e QR Code do Pix. Preços e benefícios vêm
// de shared/planosProfissional.js. Pagamento só por Pix. O texto nunca promete mais vendas: o Grátis continua completo.

const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");
const pct = (d) => Math.round(d * 100);
const OPCOES_CICLO = [
  { id: CICLOS.MENSAL, label: "Mensal" },
  { id: CICLOS.SEMESTRAL, label: "Semestral" },
  { id: CICLOS.ANUAL, label: "Anual" },
];
const CICLO_NOME = { MENSAL: "Mensal", SEMESTRAL: "Semestral", ANUAL: "Anual" };
const CICLO_SUFIXO = { MENSAL: "/mês", SEMESTRAL: "/semestre", ANUAL: "/ano" };
const dataBr = (t) => (t ? new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

// Identidade visual de cada plano — ícone colorido e cor de acento. Os textos e
// benefícios vêm EXCLUSIVAMENTE de PLANOS_PROFISSIONAL (fonte única de verdade);
// nada de listas antigas (cursos de nicho, discadora, scripts, etc.).
const META_PLANO = {
  gratis:  { Icon: User,  cor: "#8C97A3", badge: null },
  start:   { Icon: Zap,   cor: "#318CE7", badge: null },
  pro:     { Icon: Gem,   cor: "#7C3AED", badge: "Recomendado" },
  premium: { Icon: Crown, cor: "#C79A2B", badge: "Premium" },
};

// Ícone representativo de cada tópico de benefício, por palavra-chave (os textos
// são a fonte única; aqui só escolhemos um ícone que combine com o assunto).
function iconeDoBeneficio(texto) {
  const s = String(texto).toLowerCase();
  if (s.includes("tudo do")) return Layers;
  if (s.includes("imediato") || s.includes("24 hora")) return Zap;
  if (s.includes("saque")) return Wallet;
  if (s.includes("whatsapp")) return MessageCircle;
  if (s.includes("e-mail") || s.includes("email")) return Mail;
  if (s.includes("agenda") || s.includes("lembrete") || s.includes("reuni")) return CalendarClock;
  if (s.includes("convite")) return UserPlus;
  if (s.includes("divulga")) return Megaphone;
  if (s.includes("treinamento")) return GraduationCap;
  if (s.includes("simula")) return MessagesSquare;
  if (s.includes("assistente") || s.includes(" ia")) return Bot;
  if (s.includes("destacado") || s.includes("nível")) return Star;
  if (s.includes("campanha")) return Target;
  if (s.includes("candidat")) return Send;
  if (s.includes("tarefa") || s.includes("receba")) return Banknote;
  if (s.includes("perfil")) return User;
  return Check;
}

export default function PlanosProfissional({ aviso }) {
  const [info, setInfo] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [cpf, setCpf] = useState("");
  const [processando, setProcessando] = useState(false);
  const [pix, setPix] = useState(null);
  const [ciclo, setCiclo] = useState(CICLOS.MENSAL);
  const segRef = useRef(null);

  const alternar = (novo) => {
    setCiclo(novo);
    if (descontoDoCiclo(novo) > 0 && segRef.current) {
      const r = segRef.current.getBoundingClientRect();
      confetti({
        particleCount: 50, spread: 60, startVelocity: 30, gravity: 1.2, decay: 0.94, ticks: 200, shapes: ["circle"],
        origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
        colors: ["#2563EB", "#4338CA", "#0EA5E9", "#60A5FA"],
      });
    }
  };

  const carregar = async () => setInfo(await api("/profissional/plano"));
  useEffect(() => { carregar(); }, []);

  // Enquanto o QR estiver aberto, confere se o pagamento caiu.
  useEffect(() => {
    if (!pix) return undefined;
    const id = setInterval(async () => {
      const r = await api("/profissional/plano");
      if (r && !r.error) {
        setInfo(r);
        if (r.plano && r.plano !== "gratis") { setPix(null); setSelecionado(null); aviso?.(`Plano ${PLANOS_PROFISSIONAL[r.plano]?.nome} ativado!`); }
      }
    }, 6000);
    return () => clearInterval(id);
  }, [pix]);

  if (!info) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
  if (info.error) return <div className="vx-card" style={{ padding: 20 }}>{info.error}</div>;

  const atual = info.plano || "gratis";
  const noGratis = atual === "gratis";
  const assinatura = info.assinatura;
  const podeCancelar = assinatura && assinatura.origem === "asaas" && ["ativa", "atrasada", "pendente"].includes(assinatura.status);
  const precisaCpf = !info.temDocumento;

  const abrir = (chave) => {
    if (!info.cobrancaAtiva) return aviso?.("A assinatura dos planos ainda não está disponível.");
    if (!noGratis) return aviso?.("A troca de plano no meio do período ainda não está disponível.");
    setCpf("");
    setSelecionado({ ...PLANOS_PROFISSIONAL[chave], ciclo, valor: valorProfissionalNoCiclo(chave, ciclo) });
  };

  const pagar = async () => {
    if (precisaCpf && SO_DIGITOS(cpf).length !== 11) return aviso?.("Informe o seu CPF com 11 números.");
    setProcessando(true);
    const r = await api("/profissional/assinatura", { plano: selecionado.chave, ciclo: selecionado.ciclo, ...(precisaCpf ? { cpf: SO_DIGITOS(cpf) } : {}) });
    setProcessando(false);
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível gerar a cobrança.");
    await carregar();
    if (r.pix?.qrCode || r.pix?.copiaECola) setPix(r.pix);
    else { setSelecionado(null); aviso?.("Cobrança gerada. Se o Pix não aparecer, tente de novo em instantes."); }
  };

  const cancelar = async () => {
    if (!window.confirm("Cancelar a renovação? Você mantém os benefícios até o fim do período já pago.")) return;
    const r = await apiDelete("/profissional/assinatura");
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível cancelar.");
    aviso?.("Renovação cancelada.");
    carregar();
  };

  return (
    <div className="vx-fade" id="vx-planos-grid">
      <div style={{ padding: "4px 0 16px" }}>
        <div className="vx-eyebrow">Assinatura profissional</div>
        <h1 className="vx-disp" style={{ margin: "2px 0 3px" }}>Planos RYCS</h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>Comece grátis e evolua quando quiser. Cancele a renovação a qualquer momento.</p>
      </div>

      {!noGratis && (
        <div className="vx-mut" style={{ fontSize: 13, marginBottom: 14 }}>
          {info.estado === "cancelada"
            ? `Renovação cancelada. Seus benefícios do ${PLANOS_PROFISSIONAL[atual]?.nome} valem até ${dataBr(info.ate)}.`
            : `Seu plano ${PLANOS_PROFISSIONAL[atual]?.nome} vale até ${dataBr(info.ate)}.`}
          {info.estado === "atrasada" && " O pagamento da renovação está em aberto."}
        </div>
      )}

      <div style={{ padding: "4px 0 8px" }}>
        {/* Seletor de cobrança — mensal / semestral / anual (descontos reais). */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <div ref={segRef} role="radiogroup" aria-label="Ciclo de cobrança"
            style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: "var(--surface-2, #F1F5F9)", border: "1px solid var(--border)", flexWrap: "nowrap", justifyContent: "center", width: "100%", maxWidth: 360 }}>
            {OPCOES_CICLO.map((o) => {
              const ativo = ciclo === o.id;
              const desc = descontoDoCiclo(o.id);
              return (
                <button key={o.id} type="button" role="radio" aria-checked={ativo} onClick={() => alternar(o.id)}
                  style={{
                    flex: "1 1 0", minWidth: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                    padding: "8px 6px", borderRadius: 999, border: "none", cursor: "pointer",
                    fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
                    color: ativo ? "#fff" : "var(--muted)", background: ativo ? "var(--brand)" : "transparent",
                    boxShadow: ativo ? "var(--shadow-brand, 0 1px 3px rgba(37,99,235,.35))" : "none", transition: "background .2s, color .2s",
                  }}>
                  {o.label}
                  {desc > 0 && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1, flexShrink: 0, padding: "2px 5px", borderRadius: 999, background: ativo ? "rgba(255,255,255,.22)" : "var(--brand-50)", color: ativo ? "#fff" : "var(--brand)" }}>-{pct(desc)}%</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards dos planos — Free · Start · Pro · Elite (fonte única: PLANOS_PROFISSIONAL) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 16, alignItems: "stretch" }}>
          {ORDEM_PLANOS_PROFISSIONAL.map((chave, index) => {
            const p = PLANOS_PROFISSIONAL[chave];
            const m = META_PLANO[chave];
            const Icon = m.Icon;
            const isFree = chave === "gratis";
            const ehAtual = chave === atual;
            const destaque = chave === "pro"; // recomendado
            return (
              <motion.article
                key={chave}
                initial={{ y: 22, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.28, delay: 0.02 + index * 0.03 }}
                className="vx-card"
                style={{
                  position: "relative", padding: "22px 20px", display: "flex", flexDirection: "column", overflow: "hidden",
                  borderTop: `3px solid ${m.cor}`,
                  boxShadow: ehAtual ? `0 0 0 1.5px ${m.cor}, var(--shadow-card)` : undefined,
                }}
              >
                {/* Selo: plano atual tem prioridade; senão, o destaque do plano. */}
                {ehAtual ? (
                  <span style={{ position: "absolute", top: 14, right: 14, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: m.cor + "18", color: m.cor }}>Seu plano</span>
                ) : m.badge ? (
                  <span style={{ position: "absolute", top: 14, right: 14, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: m.cor + "18", color: m.cor }}>{m.badge}</span>
                ) : null}

                {/* 1. Ícone colorido + nome */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: m.cor + "16", color: m.cor, flexShrink: 0 }}>
                    <Icon size={20} strokeWidth={2.1} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase" }}>{p.nome}</span>
                </div>

                {/* 2. Preço */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {isFree ? "R$ 0" : <NumberFlow value={mensalidadeProfissional(chave, ciclo)} format={{ style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }} locales="pt-BR" transformTiming={{ duration: 500, easing: "ease-out" }} willChange />}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>/mês</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, minHeight: 15 }}>
                  {isFree ? "Para sempre"
                    : ciclo === CICLOS.ANUAL ? `${money(valorProfissionalNoCiclo(chave, ciclo))} cobrado anualmente · −${pct(descontoDoCiclo(ciclo))}%`
                    : ciclo === CICLOS.SEMESTRAL ? `${money(valorProfissionalNoCiclo(chave, ciclo))} a cada 6 meses · −${pct(descontoDoCiclo(ciclo))}%`
                    : "cobrado mensalmente"}
                </div>

                {/* 3. Descrição curta */}
                <p style={{ fontSize: 13, color: "var(--ink-2, var(--ink))", margin: "12px 0 0", lineHeight: 1.45, minHeight: 36 }}>{p.resumo}</p>

                {/* 4. Divisória */}
                <div style={{ borderTop: "1px solid var(--border)", margin: "16px 0 14px" }} />

                {/* 5. Benefícios */}
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 9, flex: 1 }}>
                  {p.beneficios.map((b) => {
                    const IconeB = iconeDoBeneficio(b);
                    return (
                      <li key={b} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--text-2, var(--ink))" }}>
                        <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: m.cor + "14", color: m.cor, marginTop: -1 }}>
                          <IconeB size={13} strokeWidth={2.2} />
                        </span>
                        {b}
                      </li>
                    );
                  })}
                </ul>

                {/* 6. Ação */}
                <button
                  type="button"
                  className={`vx-btn vx-btn-block ${ehAtual || isFree ? "" : "vx-btn-primary"}`}
                  disabled={isFree || ehAtual || !info.cobrancaAtiva}
                  onClick={() => !isFree && abrir(chave)}
                  style={{ marginTop: 18, fontWeight: 700, minHeight: 44, ...(destaque && !ehAtual && !isFree ? { background: m.cor, borderColor: m.cor } : {}) }}
                >
                  {ehAtual ? "Plano atual"
                    : isFree ? (p.cta || "Continuar gratuitamente")
                    : !info.cobrancaAtiva ? "Disponível em breve"
                    : noGratis ? (p.cta || "Assinar")
                    : "Trocar para este plano"}
                </button>
              </motion.article>
            );
          })}
        </div>

        <p className="vx-mut" style={{ fontSize: 11.5, marginTop: 18, lineHeight: 1.6, maxWidth: 680 }}>
          Pagamento por Pix. A assinatura renova automaticamente e você pode cancelar a renovação quando quiser, mantendo os benefícios até o fim do período pago. Nenhum plano garante propostas, vendas ou ganhos — o Score continua decidindo a ordem. Os prazos de saque seguem as regras vigentes de cada plano.
        </p>
      </div>

      {podeCancelar && (
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 40, paddingTop: 24, paddingBottom: 24, textAlign: "center" }}>
          <p className="vx-mut" style={{ margin: "0 0 12px", fontSize: 13 }}>Deseja encerrar sua assinatura? Você mantém os benefícios até o fim do período já pago.</p>
          <button className="vx-btn vx-btn-danger" onClick={cancelar}>Cancelar assinatura</button>
        </div>
      )}

      {/* Checkout */}
      {selecionado && !pix && (
        <div className="vx-overlay" onClick={() => setSelecionado(null)}>
          <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="vx-row">
              <div>
                <div className="vx-eyebrow">Checkout seguro</div>
                <h2 className="vx-disp" style={{ margin: "3px 0" }}>{selecionado.nome}</h2>
              </div>
              <button className="vx-btn vx-btn-ghost" aria-label="Fechar" onClick={() => setSelecionado(null)}><X size={16} /></button>
            </div>

            <div className="vx-checkout-total">
              <span>Plano {selecionado.nome} · {CICLO_NOME[selecionado.ciclo]}</span><b>{money(selecionado.valor)}</b>
              <span>Cobrança</span><b>{money(selecionado.valor)}{CICLO_SUFIXO[selecionado.ciclo]}</b>
            </div>

            {precisaCpf && (
              <label style={{ display: "block", marginBottom: 16 }}>
                <span className="vx-label">Seu CPF</span>
                <input className="vx-input vx-mono" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                  value={mascararDocumento(cpf)} onChange={(e) => setCpf(SO_DIGITOS(e.target.value).slice(0, 11))} />
                <span className="vx-mut" style={{ display: "block", fontSize: 12, marginTop: 6 }}>Pedimos uma vez só: o meio de pagamento exige o CPF de quem assina.</span>
              </label>
            )}

            <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Forma de pagamento</div>
            <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
              <QrCode size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Pix. O QR Code aparece na próxima tela e o plano é liberado assim que o pagamento for confirmado.
            </div>
            <div className="vx-mut" style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
              <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              Renova automaticamente a cada {selecionado.ciclo === CICLOS.MENSAL ? "mês" : selecionado.ciclo === CICLOS.SEMESTRAL ? "6 meses" : "ano"}. Você pode cancelar a renovação quando quiser e mantém os benefícios até o fim do período pago.
            </div>

            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16, minHeight: 44 }}
              disabled={processando || (precisaCpf && SO_DIGITOS(cpf).length !== 11)} onClick={pagar}>
              {processando ? <><Loader size={15} /> Processando…</> : <><QrCode size={15} /> Pagar com Pix {money(selecionado.valor)}</>}
            </button>
            <p className="vx-chart-source">Nenhuma cobrança é feita sem esta confirmação. Ativação apenas após confirmação do gateway.</p>
          </div>
        </div>
      )}

      {pix && (
        <div className="vx-overlay" style={{ zIndex: 1100 }}>
          <div className="vx-sheet" style={{ maxWidth: 420, textAlign: "center", padding: "32px 28px" }}>
            <QrCode size={30} color="var(--brand)" />
            <h2 style={{ margin: "12px 0 4px", fontSize: 20 }}>Pague com Pix para ativar</h2>
            <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
              Seu plano é liberado automaticamente assim que o pagamento for confirmado.
            </p>
            {pix.qrCode && (
              <img src={`data:image/png;base64,${pix.qrCode}`} alt="QR Code Pix da assinatura"
                style={{ width: 200, height: 200, margin: "0 auto 16px", display: "block", borderRadius: 10 }} />
            )}
            {pix.copiaECola && (
              <button className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 44 }} onClick={() => { navigator.clipboard?.writeText(pix.copiaECola); aviso?.("Código Pix copiado!"); }}>
                Copiar código Pix
              </button>
            )}
            <button className="vx-btn vx-btn-block" style={{ marginTop: 8, minHeight: 44 }} onClick={() => { setPix(null); setSelecionado(null); carregar(); }}>
              Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
