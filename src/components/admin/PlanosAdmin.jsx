import { useEffect, useRef, useState } from "react";
import { Copy, Link2, X, FileText } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { PLANOS, ORDEM_PLANOS, CICLOS, precoCheioNoCiclo, mesesDoCiclo, PROPOSTA_VALIDADE_DIAS } from "../../../shared/planos.js";
import PricingPlanos from "../empresa/PricingPlanos.jsx";

// Planos, na visão da plataforma.
//
// Em cima, a vitrine exatamente como a empresa vê (sem os botões de
// contratar). Embaixo, as propostas Enterprise: a RYCS combina com uma empresa
// o plano-base, o ciclo, o valor e as condições, e manda um link. A empresa
// abre o link logada, aceita as condições e paga com Pix.

const PLANOS_VITRINE = ORDEM_PLANOS.filter((k) => PLANOS[k]?.preco > 0).map((k) => ({ chave: k, ...PLANOS[k] }));
const CICLO_ROTULO = { MENSAL: "Mensal", SEMESTRAL: "Semestral", ANUAL: "Anual" };

const ESTADOS = {
  aberta: ["Aberta", "muted"],
  aceita: ["Aceita, sem Pix", "amber"],
  aguardando_pagamento: ["Pix gerado", "amber"],
  paga: ["Paga", "brand"],
  expirada: ["Expirada", "muted"],
  cancelada: ["Cancelada", "red"],
};

// Ponto de partida para o texto das condições. Só o que já foi combinado como
// regra do Enterprise — números de meta ficam para quem escreve a proposta.
const MODELO_CONDICOES = [
  "1. Exclusividade: enquanto este contrato estiver ativo e as condições abaixo forem cumpridas, a RYCS não aceita campanhas de outras empresas no nicho e no território desta proposta.",
  "2. Atividade mínima: pelo menos 25 profissionais com atividade nas campanhas da empresa a cada mês.",
  "3. Escala por resultado: enquanto as campanhas derem retorno (vendas acima do valor investido), a empresa aumenta o investimento no caixa de campanhas no mês seguinte.",
  "4. Registro de vendas: toda venda gerada pelas campanhas é registrada na plataforma com o valor, para o cálculo do retorno.",
  "5. Operação ativa: caixa de campanhas com saldo enquanto houver campanha ativa e pagamento do plano em dia.",
  "6. Profissionais: a empresa não contrata profissionais RYCS por fora da plataforma durante o contrato.",
  "7. Descumprimento: se as condições não forem cumpridas, a exclusividade termina. O plano contratado continua valendo até o fim do período pago.",
].join("\n\n");

const FORM_INICIAL = {
  cliente: "", companyId: "", planoBase: "growth", ciclo: CICLOS.SEMESTRAL,
  desconto: "0", valorFinal: "", nicho: "", territorio: "", condicoes: "",
  validadeDias: String(PROPOSTA_VALIDADE_DIAS),
};

const arred2 = (n) => Math.round(Number(n) * 100) / 100;
const dataDia = (ts) => new Date(ts).toLocaleDateString("pt-BR");

export default function PlanosAdmin({ db, aviso }) {
  const [propostas, setPropostas] = useState(null);
  const [form, setForm] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [link, setLink] = useState(null);
  const [aberta, setAberta] = useState(null);
  const formRef = useRef(null);

  const carregar = () => api("/admin/propostas").then((r) => setPropostas(r?.propostas || []));
  useEffect(() => { carregar(); }, []);

  const empresas = [...(db?.companies || [])].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

  const novaProposta = () => {
    const cheio = precoCheioNoCiclo(FORM_INICIAL.planoBase, FORM_INICIAL.ciclo);
    setForm({ ...FORM_INICIAL, valorFinal: String(cheio) });
    setLink(null);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // Desconto e valor final andam juntos: mexer num recalcula o outro, sobre o
  // preço cheio do plano-base no ciclo escolhido.
  const cheio = form ? precoCheioNoCiclo(form.planoBase, form.ciclo) : 0;
  const mudar = (campo, valor) => setForm((f) => {
    const novo = { ...f, [campo]: valor };
    const base = precoCheioNoCiclo(novo.planoBase, novo.ciclo);
    if (campo === "valorFinal") {
      const vf = Number(String(valor).replace(",", "."));
      novo.desconto = base > 0 && Number.isFinite(vf) ? String(arred2((1 - vf / base) * 100)) : novo.desconto;
    } else if (["desconto", "planoBase", "ciclo"].includes(campo)) {
      const d = Number(String(novo.desconto).replace(",", "."));
      if (Number.isFinite(d)) novo.valorFinal = String(arred2(base * (1 - d / 100)));
    }
    if (campo === "companyId" && valor && !f.cliente) novo.cliente = empresas.find((e) => e.id === valor)?.nome || "";
    return novo;
  });

  const valorFinalNum = form ? Number(String(form.valorFinal).replace(",", ".")) : 0;
  const meses = form ? mesesDoCiclo(form.ciclo) : 1;

  const gerar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    const r = await api("/admin/propostas", {
      cliente: form.cliente,
      companyId: form.companyId || undefined,
      planoBase: form.planoBase,
      ciclo: form.ciclo,
      valorFinal: valorFinalNum,
      nicho: form.nicho,
      territorio: form.territorio,
      condicoes: form.condicoes,
      validadeDias: Number(form.validadeDias) || PROPOSTA_VALIDADE_DIAS,
    });
    setEnviando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível gerar a proposta.");
    setLink(r);
    setForm(null);
    carregar();
  };

  const cancelar = async (p) => {
    if (!window.confirm(`Cancelar a proposta de ${p.cliente}? O link deixa de funcionar e um Pix já gerado também é cancelado.`)) return;
    const r = await api(`/admin/propostas/${p.id}/cancelar`, {});
    if (!r || r.error) return aviso(r?.error || "Não foi possível cancelar.");
    aviso("Proposta cancelada.");
    carregar();
  };

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <div className="vx-disp" style={{ fontSize: 22 }}>Planos</div>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={novaProposta} style={{ minHeight: 44 }}>
          <FileText size={14} /> Nova proposta Enterprise
        </button>
      </div>
      <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 18px" }}>
        A vitrine abaixo é a mesma que a empresa vê. O Enterprise aparece para ela como "sob consulta": o valor e as condições são combinados aqui, em uma proposta com link de pagamento.
      </p>

      <PricingPlanos plans={PLANOS_VITRINE} somenteLeitura onEnterprise={novaProposta} rotuloEnterprise="Criar proposta" />

      <div ref={formRef} style={{ scrollMarginTop: 80 }} />

      {link && (
        <div className="vx-card" style={{ padding: 16, marginTop: 24, borderColor: "var(--brand)", background: "var(--brand-50)" }}>
          <div className="vx-eyebrow" style={{ color: "var(--brand)", marginBottom: 7 }}>
            Proposta de {link.cliente} — copie o link agora
          </div>
          <div className="vx-mono" style={{
            fontSize: 12, wordBreak: "break-all", background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5,
          }}>{link.url}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ minHeight: 44 }}
              onClick={() => { navigator.clipboard?.writeText(link.url); aviso("Link copiado."); }}>
              <Copy size={13} /> Copiar link
            </button>
            <button className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={() => setLink(null)}>Fechar</button>
          </div>
          <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>
            {link.aviso} {PLANOS[link.planoBase]?.nome} {CICLO_ROTULO[link.ciclo]?.toLowerCase()} por {money(link.valorFinal)}, válido até {dataDia(link.expiraEm)}.
            A empresa entra com a conta dela, lê as condições, marca que aceita e paga com Pix.
          </div>
        </div>
      )}

      {form && (
        <form onSubmit={gerar} className="vx-card" style={{ padding: 20, marginTop: 24 }}>
          <div className="vx-row" style={{ marginBottom: 14 }}>
            <div>
              <div className="vx-eyebrow">Proposta Enterprise</div>
              <div className="vx-disp" style={{ fontSize: 17, marginTop: 2 }}>Valor e condições</div>
            </div>
            <button type="button" className="vx-btn vx-btn-ghost" aria-label="Fechar proposta" onClick={() => setForm(null)} style={{ minHeight: 44, minWidth: 44 }}><X size={16} /></button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
            <label><div className="vx-label">Cliente</div>
              <input className="vx-input" required value={form.cliente} onChange={(e) => mudar("cliente", e.target.value)} placeholder="Nome da empresa cliente" /></label>
            <label><div className="vx-label">Empresa na plataforma (opcional)</div>
              <select className="vx-input" value={form.companyId} onChange={(e) => mudar("companyId", e.target.value)}>
                <option value="">Qualquer empresa que abrir o link</option>
                {empresas.map((c) => <option key={c.id} value={c.id}>{c.nome || c.id}</option>)}
              </select></label>
            <label><div className="vx-label">Plano-base (recursos e taxa)</div>
              <select className="vx-input" value={form.planoBase} onChange={(e) => mudar("planoBase", e.target.value)}>
                {PLANOS_VITRINE.map((p) => <option key={p.chave} value={p.chave}>{p.nome} · {money(p.preco)}/mês · taxa {Math.round(p.takeRate * 100)}%</option>)}
              </select></label>
            <label><div className="vx-label">Ciclo</div>
              <select className="vx-input" value={form.ciclo} onChange={(e) => mudar("ciclo", e.target.value)}>
                {Object.values(CICLOS).map((c) => <option key={c} value={c}>{CICLO_ROTULO[c]} ({mesesDoCiclo(c)} {mesesDoCiclo(c) > 1 ? "meses" : "mês"})</option>)}
              </select></label>
          </div>

          <div className="vx-card" style={{ padding: "12px 14px", margin: "14px 0", background: "var(--surface-2)", boxShadow: "none" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 12, alignItems: "end" }}>
              <div>
                <div className="vx-label">Preço cheio</div>
                <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700 }}>{money(cheio)}</div>
                <div className="vx-mut" style={{ fontSize: 11.5 }}>{money(PLANOS[form.planoBase]?.preco)} × {meses}</div>
              </div>
              <label><div className="vx-label">Desconto (%)</div>
                <input className="vx-input vx-mono" inputMode="decimal" value={form.desconto} onChange={(e) => mudar("desconto", e.target.value)} /></label>
              <label><div className="vx-label">Valor que a empresa paga (R$)</div>
                <input className="vx-input vx-mono" inputMode="decimal" required value={form.valorFinal} onChange={(e) => mudar("valorFinal", e.target.value)} /></label>
              <div>
                <div className="vx-label">Equivale a</div>
                <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700 }}>{money(Number.isFinite(valorFinalNum) ? valorFinalNum / meses : 0)}/mês</div>
                <div className="vx-mut" style={{ fontSize: 11.5 }}>cobrado a cada {meses} {meses > 1 ? "meses" : "mês"}, com Pix</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
            <label><div className="vx-label">Nicho</div>
              <input className="vx-input" value={form.nicho} onChange={(e) => mudar("nicho", e.target.value)} placeholder="Ex.: plano de saúde" /></label>
            <label><div className="vx-label">Território</div>
              <input className="vx-input" value={form.territorio} onChange={(e) => mudar("territorio", e.target.value)} placeholder="Ex.: nacional" /></label>
            <label><div className="vx-label">Link vale por (dias)</div>
              <input className="vx-input vx-mono" inputMode="numeric" value={form.validadeDias} onChange={(e) => mudar("validadeDias", e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
          </div>

          <label style={{ display: "block", marginTop: 12 }}>
            <div className="vx-row" style={{ marginBottom: 5 }}>
              <span className="vx-label" style={{ margin: 0 }}>Condições (a empresa lê e aceita antes de pagar)</span>
              {!form.condicoes && (
                <button type="button" className="vx-btn vx-btn-sm" onClick={() => mudar("condicoes", MODELO_CONDICOES)}>Usar modelo</button>
              )}
            </div>
            <textarea className="vx-input" required rows={10} value={form.condicoes}
              onChange={(e) => mudar("condicoes", e.target.value)} style={{ resize: "vertical", lineHeight: 1.55 }} />
          </label>

          <div className="vx-mut" style={{ fontSize: 12, margin: "10px 0 14px", lineHeight: 1.6 }}>
            Depois de gerada, a proposta não muda: para ajustar, cancele e gere outra. A assinatura renova pelo mesmo valor a cada ciclo até ser cancelada.
          </div>

          <button type="submit" className="vx-btn vx-btn-primary" disabled={enviando} style={{ minHeight: 44 }}>
            <Link2 size={14} /> {enviando ? "Gerando…" : `Gerar link de ${money(Number.isFinite(valorFinalNum) ? valorFinalNum : 0)}`}
          </button>
        </form>
      )}

      <h3 className="vx-disp" style={{ fontSize: 16, margin: "30px 0 10px" }}>Propostas Enterprise</h3>
      {propostas === null ? <div className="vx-mut" style={{ fontSize: 13 }}>Carregando…</div>
        : propostas.length === 0 ? <div className="vx-card vx-mut" style={{ padding: 20, fontSize: 13, textAlign: "center" }}>Nenhuma proposta ainda.</div>
        : (
          <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr>
                    {["Cliente", "Plano", "Valor", "Nicho", "Status", "Validade", ""].map((h, i) => (
                      <th key={i} style={{
                        textAlign: h === "Valor" ? "right" : "left", padding: "11px 14px",
                        fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase",
                        color: "var(--muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {propostas.map((p) => {
                    const [rotulo, tom] = ESTADOS[p.estado] || [p.estado, "muted"];
                    const celula = { padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, verticalAlign: "top" };
                    return (
                      <tr key={p.id}>
                        <td style={{ ...celula, fontWeight: 500 }}>
                          {p.cliente}
                          {p.empresa && p.empresa !== p.cliente && <div className="vx-mut" style={{ fontSize: 11.5 }}>{p.empresa}</div>}
                          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: "2px 0", fontSize: 11.5 }}
                            onClick={() => setAberta(aberta === p.id ? null : p.id)}>
                            {aberta === p.id ? "Esconder condições" : "Ver condições"}
                          </button>
                          {aberta === p.id && (
                            <div className="vx-mut" style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.6, marginTop: 6, maxWidth: 420 }}>{p.condicoes}</div>
                          )}
                        </td>
                        <td style={celula}>{p.planoNome} · {CICLO_ROTULO[p.ciclo]?.toLowerCase()}</td>
                        <td className="vx-mono" style={{ ...celula, textAlign: "right", whiteSpace: "nowrap" }}>
                          {money(p.valorFinal)}
                          {p.valorOriginal > p.valorFinal && <div className="vx-mut" style={{ fontSize: 11, textDecoration: "line-through" }}>{money(p.valorOriginal)}</div>}
                        </td>
                        <td style={celula}>{[p.nicho, p.territorio].filter(Boolean).join(" · ") || <span className="vx-mut">—</span>}</td>
                        <td style={celula}>
                          <span className={`vx-badge vx-badge-${tom}`}>{rotulo}</span>
                          {p.aceitoEm && <div className="vx-mut" style={{ fontSize: 11, marginTop: 3 }}>aceita em {dataDia(p.aceitoEm)}</div>}
                        </td>
                        <td style={celula}>{dataDia(p.expiraEm)}</td>
                        <td style={celula}>
                          {!["paga", "cancelada"].includes(p.estado) && (
                            <button type="button" className="vx-btn vx-btn-sm" onClick={() => cancelar(p)}>Cancelar</button>
                          )}
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
  );
}
