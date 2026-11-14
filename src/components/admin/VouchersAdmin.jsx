import { useEffect, useMemo, useState } from "react";
import { Ticket, Plus, Trash2, Power, Check, Percent, DollarSign } from "lucide-react";
import { api, apiPatch, apiDelete } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { PLANOS, ORDEM_PLANOS } from "../../../shared/planos.js";

// Mesma normalização do backend (server/services/vouchers.js): maiúsculas, só
// A-Z/0-9/_/- e no máximo 32 caracteres. "Ricardo Martin" → "RICARDOMARTIN".
const normalizar = (c) => String(c || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);

const FORM_INICIAL = { codigo: "", tipo: "percentual", valor: "", limiteTotal: "", limitePorEmpresa: "1", validade: "", planos: [] };

export default function VouchersAdmin({ aviso }) {
  const [vouchers, setVouchers] = useState(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);

  const carregar = () => {
    setErro("");
    api("/admin/vouchers").then((r) => {
      if (!r || r.error) return setErro(r?.error || "Não foi possível carregar os vouchers.");
      setVouchers(r.vouchers || []);
    });
  };
  useEffect(carregar, []);

  const codigoNorm = useMemo(() => normalizar(form.codigo), [form.codigo]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const alternarPlano = (k) => setForm((f) => ({ ...f, planos: f.planos.includes(k) ? f.planos.filter((x) => x !== k) : [...f.planos, k] }));

  const criar = async () => {
    if (!codigoNorm) return aviso("Informe um código válido para o voucher.");
    const valor = Number(String(form.valor).replace(",", "."));
    if (!valor || valor <= 0) return aviso("Informe um valor de desconto maior que zero.");
    if (form.tipo === "percentual" && valor > 100) return aviso("Percentual máximo de 100%.");

    setSalvando(true);
    const r = await api("/vouchers", {
      codigo: codigoNorm,
      tipo: form.tipo,
      valor,
      validadeEm: form.validade ? new Date(form.validade + "T23:59:59").getTime() : null,
      limiteTotal: Number(form.limiteTotal) || 0,
      limitePorEmpresa: Number(form.limitePorEmpresa) || 1,
      planos: form.planos,
      status: "ativo",
    });
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível criar o voucher.");
    aviso(`Voucher ${r.codigo} criado.`);
    setForm(FORM_INICIAL);
    carregar();
  };

  const alternarStatus = async (v) => {
    const status = v.status === "ativo" ? "inativo" : "ativo";
    const r = await apiPatch(`/vouchers/${v.id}`, { status });
    if (!r || r.error) return aviso(r?.error || "Não foi possível alterar o voucher.");
    aviso(status === "ativo" ? "Voucher ativado." : "Voucher inativado.");
    carregar();
  };

  const excluir = async (v) => {
    if (!window.confirm(`Excluir o voucher ${v.codigo}? Esta ação não pode ser desfeita.`)) return;
    const r = await apiDelete(`/vouchers/${v.id}`);
    if (!r || r.error) return aviso(r?.error || "Não foi possível excluir o voucher.");
    aviso("Voucher excluído.");
    carregar();
  };

  const descontoLabel = (v) => v.tipo === "percentual" ? `${v.valor}%` : money(v.valor);

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Financeiro</div>
          <h1 className="vx-disp"><Ticket size={22} style={{ marginRight: 8, verticalAlign: "-4px" }} />Vouchers</h1>
          <p>Crie códigos de desconto para as assinaturas das empresas.</p>
        </div>
      </div>

      {/* ── Criação ── */}
      <div className="vx-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 14px" }}>Criar voucher</h3>

        <div className="vx-grid vx-g3" style={{ marginBottom: 12 }}>
          <label>
            <div className="vx-label">Código</div>
            <input className="vx-input" value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="Ex.: Ricardo Martin" />
            {form.codigo && codigoNorm !== form.codigo.trim() && (
              <div className="vx-mut" style={{ fontSize: 11, marginTop: 4 }}>Será salvo como <b>{codigoNorm || "—"}</b></div>
            )}
          </label>
          <label>
            <div className="vx-label">Tipo</div>
            <select className="vx-input" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              <option value="percentual">Percentual (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </select>
          </label>
          <label>
            <div className="vx-label">{form.tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }}>
                {form.tipo === "percentual" ? <Percent size={13} /> : <DollarSign size={13} />}
              </span>
              <input className="vx-input vx-mono" style={{ paddingLeft: 28 }} inputMode="decimal" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder={form.tipo === "percentual" ? "99" : "100,00"} />
            </div>
          </label>
        </div>

        <div className="vx-grid vx-g3" style={{ marginBottom: 12 }}>
          <label>
            <div className="vx-label">Limite total de usos</div>
            <input className="vx-input vx-mono" type="number" min="0" value={form.limiteTotal} onChange={(e) => set("limiteTotal", e.target.value)} placeholder="0 = ilimitado" />
          </label>
          <label>
            <div className="vx-label">Limite por empresa</div>
            <input className="vx-input vx-mono" type="number" min="0" value={form.limitePorEmpresa} onChange={(e) => set("limitePorEmpresa", e.target.value)} />
          </label>
          <label>
            <div className="vx-label">Validade <span className="vx-mut" style={{ fontSize: 11 }}>(opcional)</span></div>
            <input className="vx-input" type="date" value={form.validade} onChange={(e) => set("validade", e.target.value)} />
          </label>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="vx-label">Planos aplicáveis <span className="vx-mut" style={{ fontSize: 11 }}>(nenhum selecionado = todos)</span></div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 6 }}>
            {ORDEM_PLANOS.map((k) => {
              const on = form.planos.includes(k);
              return (
                <button key={k} type="button" className="vx-chip" onClick={() => alternarPlano(k)}
                  style={{ cursor: "pointer", border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`, background: on ? "var(--brand-50)" : "transparent", color: on ? "var(--brand)" : "var(--ink)", fontWeight: on ? 600 : 500 }}>
                  {on && <Check size={12} style={{ marginRight: 3 }} />}{PLANOS[k]?.nome || k}
                </button>
              );
            })}
          </div>
        </div>

        <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
          <Plus size={14} /> {salvando ? "Criando…" : "Criar voucher"}
        </button>
      </div>

      {/* ── Lista ── */}
      <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 12px" }}>Vouchers criados</h3>
      {erro && <div className="vx-notice vx-notice-amber" style={{ marginBottom: 12 }}>{erro}</div>}

      {vouchers === null ? (
        <div className="vx-card" style={{ padding: 18 }}><div className="vx-skeleton" style={{ height: 22 }} /></div>
      ) : !vouchers.length ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <Ticket size={26} color="var(--muted)" style={{ marginBottom: 8 }} />
          <div className="vx-mut" style={{ fontSize: 13 }}>Nenhum voucher criado ainda.</div>
        </div>
      ) : (
        <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid var(--border)" }}>
                  {["Código", "Desconto", "Usos", "Limite", "Planos", "Validade", "Status", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "var(--surface-2)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }} className="vx-mono">{v.codigo}</td>
                    <td style={{ padding: "10px 12px", color: "var(--brand)", fontWeight: 600 }}>{descontoLabel(v)}</td>
                    <td style={{ padding: "10px 12px" }} className="vx-mono">{v.usos}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{v.limiteTotal ? `${v.limiteTotal} total` : "ilimitado"}{v.limitePorEmpresa ? ` · ${v.limitePorEmpresa}/empresa` : ""}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 12 }}>{v.planos?.length ? v.planos.map((k) => PLANOS[k]?.nome || k).join(", ") : "Todos"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 12 }}>{v.validadeEm ? dataCurta(v.validadeEm) : "Sem prazo"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: "3px 10px", background: v.status === "ativo" ? "#DCFCE7" : "var(--surface-2)", color: v.status === "ativo" ? "#166534" : "var(--muted)" }}>
                        {v.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", textAlign: "right" }}>
                      <button className="vx-btn vx-btn-sm" style={{ gap: 5, marginRight: 6 }} onClick={() => alternarStatus(v)} title={v.status === "ativo" ? "Inativar" : "Ativar"}>
                        <Power size={13} /> {v.status === "ativo" ? "Inativar" : "Ativar"}
                      </button>
                      <button className="vx-btn vx-btn-sm vx-btn-danger" style={{ padding: "6px 10px" }} onClick={() => excluir(v)} title="Excluir" aria-label="Excluir">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
