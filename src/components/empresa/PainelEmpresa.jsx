import { useState } from "react";
import { Wallet, ClipboardList, Banknote, Users, TrendingUp, Clock } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, agora, dataCurta } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { Stat } from "../ui.jsx";
import CompanyScore from "../CompanyScore.jsx";

export default function PainelEmpresa({ emp, db, up, aviso }) {
  const [rec, setRec] = useState("");
  const [cobranca, setCobranca] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [doc, setDoc] = useState("");

  const salvarDocumento = async () => {
    const limpo = doc.replace(/\D/g, "");
    if (limpo.length !== 11 && limpo.length !== 14)
      return aviso("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
    await apiPatch(`/companies/${emp.id}`, { documento: limpo });
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, documento: limpo } : c) }));
    aviso("Documento salvo.");
  };
  const subs = db.submissions.filter((s) => s.companyId === emp.id);
  const pagos = subs.filter((s) => s.status === "liberado");
  const gasto = pagos.reduce((a, s) => a + s.valor, 0);
  const agendas = subs.filter((s) => s.tipo === "agendamento" && s.status === "liberado").length;
  const vendas = subs.filter((s) => s.tipo === "venda" && s.status === "liberado").length;
  const time = db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "aprovado").length;

  // Fluxo manual: a empresa declara o depósito e paga por Pix; a plataforma
  // confirma o recebimento e só então o caixa é creditado. Nada entra aqui.
  const abastecer = async () => {
    const v = Number(String(rec).replace(",", "."));
    if (!v || v < 50) return aviso("Depósito mínimo de R$ 50,00.");
    setGerando(true);
    const r = await api("/deposits", { valor: v });
    setGerando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível registrar o depósito.");
    setCobranca({ ...r, valor: v });
    setRec("");
  };

  return (
    <>
      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label="Caixa da operação" value={money(emp.saldo)} Icon={Wallet} tone="brand" />
        <Stat label="Reuniões agendadas" value={agendas} Icon={ClipboardList} tone="indigo" mono={false} />
        <Stat label="Vendas fechadas" value={vendas} Icon={Banknote} tone="amber" mono={false} />
        <Stat label="Vendedores ativos" value={time} Icon={Users} tone="muted" mono={false} />
      </div>

      <div className="vx-grid vx-g2" style={{ marginBottom: 22 }}>
        <div className="vx-card" style={{ padding: 16 }}>
          <div className="vx-row" style={{ marginBottom: 8 }}>
            <span className="vx-eyebrow">Taxa de aprovação</span>
            <TrendingUp size={14} color="var(--brand)" />
          </div>
          <div className="vx-disp vx-mono" style={{ fontSize: 28 }}>
            {subs.length > 0 ? Math.round((pagos.length / subs.length) * 100) : 0}%
          </div>
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>{pagos.length} de {subs.length} ações aprovadas</div>
        </div>
        <div className="vx-card" style={{ padding: 16 }}>
          <div className="vx-row" style={{ marginBottom: 8 }}>
            <span className="vx-eyebrow">ROI estimado</span>
            <Banknote size={14} color="var(--amber)" />
          </div>
          <div className="vx-disp vx-mono" style={{ fontSize: 28 }}>
            {emp.totalAportado > 0 ? `${((vendas * Number(emp.ticket?.replace(/[^\d]/g, "") || 0)) / emp.totalAportado * 100).toFixed(0) || 0}%` : "—"}
          </div>
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>Receita potencial vs. investimento</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CompanyScore nota={emp.nota} dimensoes={emp.scoreDimensions} />
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 8 }}>Abastecer caixa</div>
        <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
          Você só paga pelo que foi conferido. O valor sai do caixa no momento em que a ação é liberada.
        </p>
        {!emp.documento && (
          <div style={{ marginBottom: 10 }}>
            <div className="vx-label">CNPJ ou CPF do titular</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="vx-input vx-mono" value={doc} onChange={(e) => setDoc(e.target.value)}
                placeholder="00.000.000/0001-00" inputMode="numeric" />
              <button className="vx-btn" onClick={salvarDocumento}>Salvar</button>
            </div>
            <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>
              Exigido pelo banco para emitir a cobrança em nome da sua empresa.
            </div>
          </div>
        )}
        <input className="vx-input vx-mono" value={rec} onChange={(e) => setRec(e.target.value)} placeholder="1.000,00" inputMode="decimal" />
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[500, 1000, 5000].map((v) => (
            <button key={v} className="vx-btn vx-btn-sm" onClick={() => setRec(String(v))}>{money(v)}</button>
          ))}
        </div>
        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10 }} disabled={gerando} onClick={abastecer}>
          {gerando ? "Registrando…" : "Depositar por Pix"}
        </button>

        {cobranca && (
          <div className="vx-card" style={{ padding: 16, marginTop: 12, background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
            <div className="vx-disp" style={{ fontSize: 15 }}>Depósito de {money(cobranca.valor)} registrado</div>
            <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>{cobranca.instrucoes}</p>

            {cobranca.pix && (
              <div style={{ marginTop: 12 }}>
                <div className="vx-label">Chave Pix da RYCS</div>
                <div className="vx-row" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <span className="vx-mono" style={{ fontSize: 13, wordBreak: "break-all" }}>{cobranca.pix}</span>
                  <button className="vx-btn vx-btn-sm" style={{ flex: "none" }}
                    onClick={() => { navigator.clipboard?.writeText(cobranca.pix); aviso("Chave Pix copiada."); }}>Copiar</button>
                </div>
                <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>Titular: {cobranca.titular}</div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div className="vx-label">Coloque esta referência na transferência</div>
              <div className="vx-row" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <span className="vx-mono vx-disp" style={{ fontSize: 15, color: "var(--brand)" }}>{cobranca.referencia}</span>
                <button className="vx-btn vx-btn-sm" style={{ flex: "none" }}
                  onClick={() => { navigator.clipboard?.writeText(cobranca.referencia); aviso("Referência copiada."); }}>Copiar</button>
              </div>
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>
                É ela que liga o seu Pix a este pedido.
              </div>
            </div>

            <button className="vx-btn vx-btn-ghost vx-btn-sm vx-btn-block" style={{ marginTop: 10 }} onClick={() => setCobranca(null)}>Fechar</button>
          </div>
        )}
        <hr className="vx-sep" />
        <div className="vx-row" style={{ fontSize: 13 }}>
          <span className="vx-mut">Pago em comissões</span><b className="vx-mono">{money(gasto)}</b>
        </div>
        <div className="vx-row" style={{ fontSize: 13, marginTop: 6 }}>
          <span className="vx-mut">Total já investido na plataforma</span><b className="vx-mono">{money(emp.totalAportado || 0)}</b>
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 12 }}>
          <Clock size={16} style={{ marginRight: 6, verticalAlign: -2 }} />Atividade recente
        </div>
        {subs.length === 0 && <div className="vx-mut" style={{ fontSize: 13, padding: "8px 0" }}>Nenhuma ação registrada ainda.</div>}
        {subs.slice(0, 8).map((s) => {
          const seller = db.sellers.find((sl) => sl.id === s.sellerId);
          const statusCor = { liberado: "var(--brand)", recusado: "var(--red)", revisao: "var(--amber)", ia_aprovado: "var(--indigo)", analisando: "var(--muted)" };
          const statusLabel = { liberado: "Aprovada", recusado: "Recusada", revisao: "Revisão", ia_aprovado: "Pré-aprovada", analisando: "Analisando", conferido: "Conferida" };
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: statusCor[s.status] || "var(--muted)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{ACOES[s.tipo]?.nome || s.tipo} — {money(s.valor)}</div>
                <div className="vx-mut" style={{ fontSize: 12 }}>{seller?.nome || "Vendedor"} · {dataCurta(s.criadoEm)}</div>
              </div>
              <span className="vx-badge" style={{ background: `${statusCor[s.status] || "var(--muted)"}15`, color: statusCor[s.status] || "var(--muted)", fontSize: 11 }}>
                {statusLabel[s.status] || s.status}
              </span>
            </div>
          );
        })}
      </div>

      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 4 }}>Posição na vitrine</div>
        <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
          Empresas em destaque aparecem no topo da lista dos vendedores e recebem cerca de 3x mais candidaturas.
        </p>
        <div className="vx-row" style={{ padding: "10px 0" }}>
          <div>
            <b style={{ fontSize: 13.5 }}>Destaque no topo</b>
            <div className="vx-mut" style={{ fontSize: 12 }}>R$ 490/mês, cancela quando quiser</div>
          </div>
          <button className={"vx-btn vx-btn-sm" + (emp.destaque ? "" : " vx-btn-primary")}
            onClick={() => { apiPatch(`/companies/${emp.id}`, { destaque: !emp.destaque }); up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, destaque: !c.destaque } : c) })); aviso(emp.destaque ? "Destaque cancelado." : "Destaque ativado."); }}>
            {emp.destaque ? "Cancelar destaque" : "Ativar destaque"}
          </button>
        </div>
      </div>
    </>
  );
}
