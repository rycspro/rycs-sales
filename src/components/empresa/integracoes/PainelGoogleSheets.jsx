import { useEffect, useState } from "react";
import { FileSpreadsheet, Upload, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../../../lib/api.js";

const CAMPOS = [
  { chave: "nome", rotulo: "Nome", obrigatorio: true },
  { chave: "email", rotulo: "E-mail" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "empresa", rotulo: "Empresa" },
  { chave: "cargo", rotulo: "Cargo" },
];

export default function PainelGoogleSheets({ aviso }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [mapeamento, setMapeamento] = useState({});
  const [campanhas, setCampanhas] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [sellerId, setSellerId] = useState("auto");
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api("/campaigns").then((r) => setCampanhas(Array.isArray(r) ? r.filter((c) => c.status === "ativa") : [])).catch(() => {});
    api("/sellers").then((r) => setVendedores(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const buscarPreview = async () => {
    setErro(""); setPreview(null); setResultado(null); setMapeamento({});
    if (!url.includes("docs.google.com/spreadsheets")) return setErro("Cole a URL de uma planilha do Google Sheets.");
    setOcupado(true);
    try {
      const r = await api("/google-sheets/preview", { url });
      if (r.error) { setErro(r.error); return; }
      setPreview(r);
      const m = {};
      const lower = r.cabecalhos.map((h) => h.toLowerCase().trim());
      CAMPOS.forEach(({ chave }) => {
        const sinônimos = {
          nome: ["nome", "name", "nome completo", "full name", "nome_completo"],
          email: ["email", "e-mail", "e_mail", "mail"],
          telefone: ["telefone", "phone", "tel", "celular", "whatsapp", "fone"],
          empresa: ["empresa", "company", "organização", "organizacao"],
          cargo: ["cargo", "position", "job", "função", "funcao", "role"],
        };
        const idx = lower.findIndex((h) => sinônimos[chave]?.includes(h));
        if (idx >= 0) m[chave] = r.cabecalhos[idx];
      });
      setMapeamento(m);
    } catch { setErro("Não foi possível acessar a planilha."); }
    finally { setOcupado(false); }
  };

  const importar = async () => {
    if (!mapeamento.nome) return setErro("Mapeie pelo menos a coluna Nome.");
    if (!campaignId) return setErro("Selecione uma campanha.");
    setErro(""); setOcupado(true);
    try {
      const r = await api("/google-sheets/importar", {
        url, mapeamento, campaignId,
        sellerId: sellerId === "auto" ? undefined : sellerId,
        autoDistribuir: sellerId === "auto",
      });
      if (r.error) { setErro(r.error); return; }
      setResultado(r);
      aviso?.(`${r.importados} contato(s) importado(s) do Google Sheets.`);
    } catch { setErro("Erro ao importar. Tente novamente."); }
    finally { setOcupado(false); }
  };

  const Rotulo = ({ children, obrigatorio }) => (
    <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
      {children}{obrigatorio && <span style={{ color: "var(--red)", marginLeft: 3 }}>*</span>}
    </label>
  );

  if (resultado) return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--green-50, #ECFDF5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <CheckCircle2 size={26} style={{ color: "var(--green, #10B981)" }} />
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>Importação concluída</h3>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
        <p style={{ margin: "0 0 4px" }}><b>{resultado.importados}</b> contato(s) importado(s)</p>
        {resultado.duplicados > 0 && <p style={{ margin: "0 0 4px" }}>{resultado.duplicados} duplicado(s) ignorado(s)</p>}
        {resultado.invalidos > 0 && <p style={{ margin: 0 }}>{resultado.invalidos} linha(s) com erro</p>}
      </div>
      <button type="button" className="vx-btn vx-btn-primary" onClick={() => { setResultado(null); setPreview(null); setUrl(""); }} style={{ marginTop: 20 }}>
        Importar outra planilha
      </button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
        Importe contatos de uma planilha pública do Google Sheets. A planilha precisa estar compartilhada como
        <b> "Qualquer pessoa com o link"</b>.
      </p>

      {/* URL */}
      <div>
        <Rotulo obrigatorio>URL da planilha</Rotulo>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="vx-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            style={{ flex: 1, fontSize: 12.5 }}
          />
          <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" disabled={ocupado || !url} onClick={buscarPreview} style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {ocupado ? <Loader2 size={14} className="vx-spin" /> : <FileSpreadsheet size={14} />}
            {ocupado ? "Lendo..." : "Buscar"}
          </button>
        </div>
      </div>

      {erro && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", background: "var(--red-50, #FEF2F2)", borderRadius: 8, fontSize: 12.5, color: "var(--red, #EF4444)", lineHeight: 1.5 }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {erro}
        </div>
      )}

      {preview && (
        <>
          <div style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12.5, color: "var(--ink-2)" }}>
            <b>{preview.totalLinhas}</b> linha(s) encontrada(s) · <b>{preview.cabecalhos.length}</b> coluna(s)
          </div>

          {/* Preview da tabela */}
          <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr>
                  {preview.cabecalhos.map((h) => (
                    <th key={h} style={{ padding: "8px 10px", background: "var(--surface-2)", color: "var(--ink-2)", fontWeight: 600, textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, i) => (
                  <tr key={i}>
                    {preview.cabecalhos.map((h) => (
                      <td key={h} style={{ padding: "7px 10px", borderBottom: "1px solid var(--border)", color: "var(--muted)", whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mapeamento de colunas */}
          <div>
            <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Mapeamento de colunas</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {CAMPOS.map(({ chave, rotulo, obrigatorio }) => (
                <div key={chave} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 80, fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)" }}>
                    {rotulo}{obrigatorio && <span style={{ color: "var(--red)" }}>*</span>}
                  </span>
                  <ArrowRight size={13} style={{ color: "var(--muted-2)", flexShrink: 0 }} />
                  <select
                    className="vx-input"
                    value={mapeamento[chave] || ""}
                    onChange={(e) => setMapeamento((m) => ({ ...m, [chave]: e.target.value || undefined }))}
                    style={{ flex: 1, fontSize: 12.5 }}
                  >
                    <option value="">— Ignorar —</option>
                    {preview.cabecalhos.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Campanha + Vendedor */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Rotulo obrigatorio>Campanha</Rotulo>
              <select className="vx-input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={{ fontSize: 12.5 }}>
                <option value="">Selecione...</option>
                {campanhas.map((c) => <option key={c.id} value={c.id}>{c.name || c.nome}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Rotulo>Profissional</Rotulo>
              <select className="vx-input" value={sellerId} onChange={(e) => setSellerId(e.target.value)} style={{ fontSize: 12.5 }}>
                <option value="auto">Auto-distribuir</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.name || v.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Botão importar */}
          <button type="button" className="vx-btn vx-btn-primary" disabled={ocupado || !mapeamento.nome || !campaignId} onClick={importar} style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
            {ocupado ? <Loader2 size={15} className="vx-spin" /> : <Upload size={15} />}
            {ocupado ? "Importando..." : `Importar ${preview.totalLinhas > 1000 ? "1.000" : preview.totalLinhas} contato(s)`}
          </button>
          {preview.totalLinhas > 1000 && (
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--amber)" }}>Limite de 1.000 contatos por importação. As demais linhas serão ignoradas.</p>
          )}
        </>
      )}
    </div>
  );
}
