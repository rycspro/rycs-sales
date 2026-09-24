import { useMemo, useState } from "react";
import { Building2, CheckCircle2, CircleAlert, FileScan, FileText, Send } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { camposPendentesEmpresa } from "../../../shared/empresa.js";

const campos = [
  ["nome", "Nome fantasia"], ["razaoSocial", "Razão social"], ["documento", "CNPJ ou CPF"],
  ["endereco", "Endereço completo"], ["representanteLegal", "Representante legal"],
  ["contatoFinanceiro", "Contato financeiro"], ["contatoComercial", "Contato comercial"],
  ["produto", "Produto ou serviço"], ["segmento", "Segmento"], ["regiao", "Região atendida"],
  ["situacaoCadastral", "Situação cadastral"], ["dataAbertura", "Data de abertura"],
  ["naturezaJuridica", "Natureza jurídica"], ["cnaes", "CNAEs"],
  ["telefoneEmpresa", "Telefone da empresa"], ["emailEmpresa", "E-mail da empresa"],
];

export default function CadastroEmpresa({ emp, up, aviso, camposDestacados = [] }) {
  const [form, setForm] = useState(() => ({ ...emp, materiais: emp.materiais || [] }));
  const [salvando, setSalvando] = useState(false);
  const [material, setMaterial] = useState({ nome: "", url: "" });
  const [cnpjPreview,setCnpjPreview]=useState(null),[lendoCnpj,setLendoCnpj]=useState(false);
  const lerCnpj=async(file)=>{if(!file)return;setLendoCnpj(true);const base64=await new Promise((ok)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]);r.readAsDataURL(file)});const out=await api(`/companies/${emp.id}/cnpj/extract`,{base64,mimetype:file.type});setLendoCnpj(false);if(out?.error)return aviso(out.error);setCnpjPreview(out);};
  const aplicarCnpj=()=>{setForm((f)=>({...f,...Object.fromEntries(Object.entries(cnpjPreview.dados||{}).filter(([,v])=>String(v||"").trim()))}));setCnpjPreview(null);aviso("Dados aplicados à prévia. Revise e clique em Salvar cadastro para confirmar.");};
  const pendencias = useMemo(() => camposPendentesEmpresa(form), [form]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const adicionarMaterial = () => {
    if (!material.nome.trim() || !/^https?:\/\//i.test(material.url)) return aviso("Informe nome e URL válida do material.");
    setForm((f) => ({ ...f, materiais: [...(f.materiais || []), { ...material, id: `mat-${Date.now()}` }] }));
    setMaterial({ nome: "", url: "" });
  };
  const salvar = async () => {
    setSalvando(true);
    const payload = Object.fromEntries([...campos.map(([k]) => [k, form[k] || ""]),
      ["ticket", form.ticket || ""], ["icp", form.icp || ""], ["diferenciais", form.diferenciais || ""],
      ["objecoes", form.objecoes || ""], ["materiais", form.materiais || []]]);
    const r = await apiPatch(`/companies/${emp.id}`, payload);
    setSalvando(false);
    if (!r || r.error) { aviso(r?.error || "Não foi possível salvar."); return false; }
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, ...payload } : c) }));
    aviso("Cadastro empresarial salvo.");
    return true;
  };
  const enviar = async () => {
    if (!await salvar()) return;
    const r = await api(`/companies/${emp.id}/submit-review`, {});
    if (!r || r.error) return aviso(r?.pendencias?.join(", ") || r?.error || "Não foi possível enviar.");
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, statusCadastro: "em_analise" } : c) }));
    aviso("Cadastro enviado para aprovação da plataforma.");
  };
  const status = { rascunho: "Rascunho", em_analise: "Em análise", aprovada: "Aprovada", suspensa: "Suspensa" }[emp.statusCadastro] || "Rascunho";

  return <div className="vx-fade" style={{ maxWidth: 900 }}>
    <div className="vx-row" style={{ alignItems: "flex-start", gap: 16 }}>
      <div>
        <div className="vx-eyebrow">Ativação da conta</div>
        <h2 className="vx-disp" style={{ fontSize: 24, margin: "5px 0" }}>Cadastro empresarial</h2>
        <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Complete os dados usados na aprovação, nas cobranças e nas campanhas.</p>
      </div>
      <span className="vx-chip"><Building2 size={13} /> {status}</span>
    </div>

    <div className="vx-card" style={{ padding: 18, marginTop: 18 }}>
      <div className="vx-row" style={{marginBottom:14,flexWrap:"wrap"}}><div><b><FileScan size={15} style={{verticalAlign:-3,marginRight:6}}/>Leitura do cartão CNPJ</b><div className="vx-mut" style={{fontSize:12}}>Imagem ou PDF → extração → prévia → revisão → confirmação.</div></div><label className="vx-btn vx-btn-sm">{lendoCnpj?"Lendo…":"Enviar cartão CNPJ"}<input hidden type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e)=>lerCnpj(e.target.files?.[0])}/></label></div>
      {cnpjPreview&&<div className="vx-notice" style={{marginBottom:14}}><b>Prévia extraída · confiança {cnpjPreview.confianca}</b><div className="vx-grid vx-g2" style={{marginTop:9}}>{Object.entries(cnpjPreview.dados||{}).map(([k,v])=><div key={k}><span className="vx-label">{k}</span><span>{v||"Não encontrado"}</span></div>)}</div><button className="vx-btn vx-btn-primary vx-btn-sm" style={{marginTop:10}} onClick={aplicarCnpj}>Confirmar dados na prévia</button></div>}
      <div className="vx-grid vx-g2">
        {campos.map(([k, label]) => <label key={k}><div className="vx-label" style={camposDestacados.includes(k) ? { color: "var(--amber)", fontWeight: 700 } : undefined}>{label}{camposDestacados.includes(k) ? " · necessário para a IA" : ""}</div><input className="vx-input" style={camposDestacados.includes(k) ? { borderColor: "var(--amber)" } : undefined} value={form[k] || ""} onChange={set(k)} /></label>)}
        <label><div className="vx-label">Ticket médio</div><input className="vx-input" value={form.ticket || ""} onChange={set("ticket")} placeholder="Ex.: R$ 1.500 por mês" /></label>
        <label><div className="vx-label" style={camposDestacados.includes("icp") ? { color: "var(--amber)", fontWeight: 700 } : undefined}>ICP{camposDestacados.includes("icp") ? " · necessário para a IA" : ""}</div><input className="vx-input" style={camposDestacados.includes("icp") ? { borderColor: "var(--amber)" } : undefined} value={form.icp || ""} onChange={set("icp")} placeholder="Quem compra e em qual contexto" /></label>
      </div>
      <label style={{ display: "block", marginTop: 14 }}><div className="vx-label" style={camposDestacados.includes("diferenciais") ? { color: "var(--amber)", fontWeight: 700 } : undefined}>Diferenciais{camposDestacados.includes("diferenciais") ? " · necessário para a IA" : ""}</div><textarea className="vx-input" style={{ minHeight: 76, ...(camposDestacados.includes("diferenciais") ? { borderColor: "var(--amber)" } : {}) }} value={form.diferenciais || ""} onChange={set("diferenciais")} /></label>
      <label style={{ display: "block", marginTop: 14 }}><div className="vx-label" style={camposDestacados.includes("objecoes") ? { color: "var(--amber)", fontWeight: 700 } : undefined}>Objeções mais comuns{camposDestacados.includes("objecoes") ? " · necessário para a IA" : ""}</div><textarea className="vx-input" style={{ minHeight: 76, ...(camposDestacados.includes("objecoes") ? { borderColor: "var(--amber)" } : {}) }} value={form.objecoes || ""} onChange={set("objecoes")} /></label>
    </div>

    <div className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row"><b><FileText size={15} style={{ verticalAlign: -3, marginRight: 6 }} />Materiais comerciais</b><span className="vx-chip">{form.materiais?.length || 0}</span></div>
      <div className="vx-grid vx-g2" style={{ marginTop: 12 }}><input className="vx-input" placeholder="Nome do material" value={material.nome} onChange={(e) => setMaterial((m) => ({ ...m, nome: e.target.value }))} /><input className="vx-input" placeholder="https://..." value={material.url} onChange={(e) => setMaterial((m) => ({ ...m, url: e.target.value }))} /></div>
      <button className="vx-btn vx-btn-sm" style={{ marginTop: 9 }} onClick={adicionarMaterial}>Adicionar material</button>
      {(form.materiais || []).map((m) => <div key={m.id} className="vx-row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}><a href={m.url} target="_blank" rel="noreferrer">{m.nome}</a><button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => setForm((f) => ({ ...f, materiais: f.materiais.filter((x) => x.id !== m.id) }))}>Remover</button></div>)}
    </div>

    <div className="vx-card" style={{ padding: 16, marginTop: 16, borderColor: pendencias.length ? "var(--amber)" : "var(--brand)" }}>
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>{pendencias.length ? <CircleAlert size={18} color="var(--amber)" /> : <CheckCircle2 size={18} color="var(--brand)" />}<div><b>{pendencias.length ? `${pendencias.length} pendência(s)` : "Cadastro pronto para análise"}</b>{pendencias.length > 0 && <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 3 }}>{pendencias.join(" · ")}</div>}</div></div>
    </div>
    <div style={{ display: "flex", gap: 9, marginTop: 16 }}><button className="vx-btn vx-btn-primary" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar cadastro"}</button><button className="vx-btn" disabled={pendencias.length > 0 || emp.statusCadastro === "aprovada"} onClick={enviar}><Send size={14} /> Enviar para análise</button></div>
  </div>;
}
