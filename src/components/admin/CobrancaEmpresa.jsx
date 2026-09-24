import { useState, useEffect } from "react";
import { api, apiPatch } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";

const BILLING_LABELS = {
  ativa: { txt: "Ativa", color: "#22A06B" },
  isenta: { txt: "Isenta", color: "#6366F1" },
  pausada: { txt: "Pausada", color: "#F59E0B" },
};
const ACCESS_LABELS = {
  ativo: { txt: "Ativo", color: "#22A06B" },
  bloqueado: { txt: "Bloqueado", color: "#EF4444" },
};

export default function CobrancaEmpresa({ empresa, aviso, onVoltar }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { tipo: 'isentar'|'pausar'|'bloquear'|'liberar'|'reativar'|'pagamento' }
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  const carregar = () => {
    setLoading(true);
    api(`/admin/companies/${empresa.id}/billing`).then((r) => {
      if (r && !r.error) setData(r);
      setLoading(false);
    });
  };

  useEffect(() => { carregar(); }, [empresa.id]);

  const acao = async (billing_status, access_status, extra = {}) => {
    setSalvando(true);
    const body = {};
    if (billing_status) body.billing_status = billing_status;
    if (access_status) body.access_status = access_status;
    if (extra.motivo) body.motivo = extra.motivo;
    if (extra.isencao_ate) body.isencao_ate = extra.isencao_ate;
    const r = await apiPatch(`/admin/companies/${empresa.id}/billing/status`, body);
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    aviso("Configuração salva.");
    setModal(null);
    setForm({});
    carregar();
  };

  const gerarPagamento = async () => {
    setSalvando(true);
    const r = await api(`/admin/companies/${empresa.id}/billing/payment`, {
      descricao: form.descricao,
      valor: Number(form.valor),
      metodo: form.metodo || "pix",
    });
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    aviso("Cobrança gerada com sucesso.");
    setModal(null);
    setForm({});
  };

  if (loading) return <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Carregando...</div>;
  if (!data) return <div className="vx-card" style={{ padding: 24, color: "var(--red)" }}>Erro ao carregar dados de cobrança.</div>;

  const { billing, historico } = data;
  const bs = BILLING_LABELS[billing.billing_status] || BILLING_LABELS.ativa;
  const as = ACCESS_LABELS[billing.access_status] || ACCESS_LABELS.ativo;

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 20 }}>
        <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={onVoltar}>← Voltar</button>
        <div className="vx-disp" style={{ fontSize: 18 }}>Cobrança e Acesso — {empresa.nome}</div>
      </div>

      {/* Status atual */}
      <div className="vx-grid vx-g2" style={{ marginBottom: 20 }}>
        <div className="vx-card" style={{ padding: 20 }}>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 6 }}>MENSALIDADE</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: bs.color, marginBottom: 10 }}>{bs.txt}</div>
          {billing.billing_status === "isenta" && billing.isencao_motivo && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Motivo: {billing.isencao_motivo}</div>
          )}
          {billing.billing_status === "isenta" && billing.isencao_ate && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Até: {dataCurta(billing.isencao_ate)}</div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {billing.billing_status !== "isenta" && (
              <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => { setModal("isentar"); setForm({}); }}>
                Tornar isenta
              </button>
            )}
            {billing.billing_status === "isenta" && (
              <button className="vx-btn vx-btn-sm" onClick={() => acao("ativa", null, { motivo: "Reativação" })}>
                Reativar cobrança
              </button>
            )}
            {billing.billing_status === "ativa" && (
              <button className="vx-btn vx-btn-sm" onClick={() => { setModal("pausar"); setForm({}); }}>
                Pausar cobrança
              </button>
            )}
            {billing.billing_status === "pausada" && (
              <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => acao("ativa", null, { motivo: "Reativação" })}>
                Reativar cobrança
              </button>
            )}
          </div>
        </div>

        <div className="vx-card" style={{ padding: 20 }}>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 6 }}>ACESSO</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: as.color, marginBottom: 14 }}>{as.txt}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {billing.access_status === "ativo" ? (
              <button className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => { setModal("bloquear"); setForm({}); }}>
                Bloquear acesso
              </button>
            ) : (
              <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => acao(null, "ativo", { motivo: "Liberação administrativa" })}>
                Liberar acesso
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gerar pagamento */}
      <div className="vx-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <b>Gerar pagamento</b>
            <div className="vx-mut" style={{ fontSize: 12 }}>Somente PIX e Cartão. Sem boleto.</div>
          </div>
          <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => { setModal("pagamento"); setForm({ metodo: "pix" }); }}>
            + Gerar cobrança
          </button>
        </div>
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="vx-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>
            Histórico administrativo
          </div>
          {historico.map((h) => (
            <div key={h.id} style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span className="vx-mono" style={{ fontSize: 11, color: "var(--muted)" }}>{dataCurta(h.criadoEm)}</span>
                <span style={{ fontWeight: 600 }}>
                  {h.status_anterior} → <span style={{ color: "var(--brand)" }}>{h.status_novo}</span>
                </span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{h.campo === "billing_status" ? "Cobrança" : "Acesso"}</span>
              </div>
              {h.motivo && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Motivo: {h.motivo}</div>}
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>Por: {h.adminEmail || h.adminId}</div>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="vx-card" style={{ width: "100%", maxWidth: 440, padding: 28, margin: 16 }}>

            {modal === "isentar" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 16 }}>Tornar empresa isenta</div>
                <label className="vx-label">Motivo</label>
                <input className="vx-input" value={form.motivo || ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex: Empresa interna" />
                <label className="vx-label" style={{ marginTop: 12 }}>Prazo</label>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" checked={!form.isencao_ate} onChange={() => setForm({ ...form, isencao_ate: null })} /> Sem prazo
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" checked={!!form.isencao_ate} onChange={() => setForm({ ...form, isencao_ate: new Date().toISOString().split("T")[0] })} /> Até data:
                  </label>
                  {form.isencao_ate !== undefined && form.isencao_ate !== null && (
                    <input type="date" className="vx-input" style={{ width: 140 }} value={form.isencao_ate} onChange={(e) => setForm({ ...form, isencao_ate: e.target.value })} />
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={() => acao("isenta", null, form)}>Confirmar</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>Cancelar</button>
                </div>
              </>
            )}

            {modal === "pausar" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 16 }}>Pausar cobrança</div>
                <label className="vx-label">Motivo (opcional)</label>
                <input className="vx-input" value={form.motivo || ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Motivo" />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={() => acao("pausada", null, form)}>Pausar</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>Cancelar</button>
                </div>
              </>
            )}

            {modal === "bloquear" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 8 }}>Bloquear acesso</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>Dados preservados: empresa, campanhas, Academy, financeiro.</div>
                <label className="vx-label">Motivo</label>
                <input className="vx-input" value={form.motivo || ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Informe o motivo" />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="vx-btn vx-btn-danger" disabled={salvando || !form.motivo} onClick={() => acao(null, "bloqueado", form)}>Bloquear</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>Cancelar</button>
                </div>
              </>
            )}

            {modal === "pagamento" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 16 }}>Gerar cobrança</div>
                <div style={{ marginBottom: 8, fontSize: 13 }}>Empresa: <b>{empresa.nome}</b></div>
                <label className="vx-label">Descrição</label>
                <input className="vx-input" value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Mensalidade setembro" />
                <label className="vx-label" style={{ marginTop: 12 }}>Valor (R$)</label>
                <input className="vx-input" type="number" min="1" value={form.valor || ""} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
                <label className="vx-label" style={{ marginTop: 12 }}>Forma de pagamento</label>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" checked={form.metodo === "pix"} onChange={() => setForm({ ...form, metodo: "pix" })} /> PIX
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" checked={form.metodo === "cartao"} onChange={() => setForm({ ...form, metodo: "cartao" })} /> Cartão
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="vx-btn vx-btn-primary" disabled={salvando || !form.descricao || !form.valor} onClick={gerarPagamento}>Confirmar</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
