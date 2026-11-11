import { useState, useEffect } from "react";
import { api, apiPatch } from "../../lib/api.js";
import { money } from "../../lib/utils.js";

// Card "Abastecer caixa": depósito por Pix da empresa. Antes vivia dentro de
// Insights › Desempenho; movido para Pagamentos › Campanhas.
export default function AbastecerCaixa({ emp, db, up, aviso }) {
  const [rec, setRec] = useState("");
  const [cobranca, setCobranca] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [doc, setDoc] = useState("");
  const [minimo, setMinimo] = useState(1);

  useEffect(() => {
    api("/deposits/config").then((c) => { if (c?.minimo) setMinimo(c.minimo); });
  }, []);

  const subsTodos = db.submissions.filter((s) => s.companyId === emp.id);
  const pagos = subsTodos.filter((s) => s.status === "liberado");
  const gasto = pagos.reduce((a, s) => a + Number(s.valor || 0), 0);

  const salvarDocumento = async () => {
    const limpo = doc.replace(/\D/g, "");
    if (limpo.length !== 11 && limpo.length !== 14)
      return aviso("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
    await apiPatch(`/companies/${emp.id}`, { documento: limpo });
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, documento: limpo } : c) }));
    aviso("Documento salvo.");
  };

  // Fluxo manual: a empresa declara o depósito e paga por Pix; a plataforma
  // confirma o recebimento e só então o caixa é creditado. Nada entra aqui.
  const abastecer = async () => {
    const v = Number(String(rec).replace(",", "."));
    if (!v || v < minimo) return aviso(`Depósito mínimo de ${money(minimo)}.`);
    setGerando(true);
    const r = await api("/deposits", { valor: v });
    setGerando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível registrar o depósito.");
    setCobranca({ ...r, valor: v });
    setRec("");
  };

  return (
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
      <input className="vx-input vx-mono" value={rec} onChange={(e) => setRec(e.target.value)} placeholder="100,00" inputMode="decimal" />
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {[Math.max(minimo, 50), 100, 500].map((v) => (
          <button key={v} className="vx-btn vx-btn-sm" onClick={() => setRec(String(v))}>{money(v)}</button>
        ))}
      </div>
      <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10 }} disabled={gerando} onClick={abastecer}>
        {gerando ? "Registrando…" : "Depositar por Pix"}
      </button>

      {cobranca && (
        <div className="vx-card" style={{ padding: 16, marginTop: 12, background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
          <div className="vx-disp" style={{ fontSize: 15 }}>
            {cobranca.modo === "gateway" ? "Cobrança de" : "Depósito de"} {money(cobranca.valorBruto ?? cobranca.valor)}
          </div>
          {cobranca.taxaGateway > 0 && (
            <div style={{ fontSize: 12.5, marginTop: 6 }}>
              <div className="vx-row"><span className="vx-mut">Valor bruto</span><span className="vx-mono">{money(cobranca.valorBruto)}</span></div>
              <div className="vx-row"><span className="vx-mut">Taxa de processamento</span><span className="vx-mono" style={{ color: "var(--red)" }}>− {money(cobranca.taxaGateway)}</span></div>
              <div className="vx-row"><span style={{ fontWeight: 600 }}>Creditado no caixa</span><span className="vx-mono" style={{ fontWeight: 600, color: "var(--brand)" }}>{money(cobranca.valorLiquido)}</span></div>
            </div>
          )}
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>{cobranca.instrucoes}</p>

          {cobranca.pixQrCodeBase64 && (
            <img src={`data:image/png;base64,${cobranca.pixQrCodeBase64}`} alt="QR Code Pix"
              style={{ width: 190, display: "block", margin: "14px auto", borderRadius: 10, background: "#fff", padding: 8 }} />
          )}

          {cobranca.pixCopiaECola && (
            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 6 }}
              onClick={() => { navigator.clipboard?.writeText(cobranca.pixCopiaECola); aviso("Código Pix copiado."); }}>
              Copiar código Pix
            </button>
          )}

          {cobranca.invoiceUrl && (
            <a className="vx-btn vx-btn-sm vx-btn-block" style={{ marginTop: 6 }} target="_blank" rel="noreferrer" href={cobranca.invoiceUrl}>
              Abrir fatura
            </a>
          )}

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

          {cobranca.referencia && (
            <div style={{ marginTop: 12 }}>
              <div className="vx-label">Coloque esta referência na transferência</div>
              <div className="vx-row" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <span className="vx-mono vx-disp" style={{ fontSize: 15, color: "var(--brand)" }}>{cobranca.referencia}</span>
                <button className="vx-btn vx-btn-sm" style={{ flex: "none" }}
                  onClick={() => { navigator.clipboard?.writeText(cobranca.referencia); aviso("Referência copiada."); }}>Copiar</button>
              </div>
            </div>
          )}

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
  );
}
