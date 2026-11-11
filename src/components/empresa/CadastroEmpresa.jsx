import { useMemo, useState } from "react";
import { Building2, CheckCircle2, CircleAlert, FileScan, FileText, Send } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { camposPendentesEmpresa } from "../../../shared/empresa.js";
import { useI18n } from "../../lib/i18n.jsx";

function buildCampos(t) {
  return [
    ["nome", t("reg.tradeName")], ["razaoSocial", t("reg.legalName")], ["documento", t("reg.docNumber")],
    ["endereco", t("reg.fullAddress")], ["representanteLegal", t("reg.legalRep")],
    ["contatoFinanceiro", t("reg.finContact")], ["contatoComercial", t("reg.bizContact")],
    ["produto", t("reg.productService")], ["segmento", t("reg.segment")], ["regiao", t("reg.regionServed")],
    ["situacaoCadastral", t("reg.regStatus")], ["dataAbertura", t("reg.openDate")],
    ["naturezaJuridica", t("reg.legalNature")], ["cnaes", t("reg.cnaes")],
    ["telefoneEmpresa", t("reg.companyPhone")], ["emailEmpresa", t("reg.companyEmail")],
  ];
}

export default function CadastroEmpresa({ emp, up, aviso, camposDestacados = [] }) {
  const { t } = useI18n();
  const campos = buildCampos(t);
  const [form, setForm] = useState(() => ({ ...emp, materiais: emp.materiais || [] }));
  const [salvando, setSalvando] = useState(false);
  const [material, setMaterial] = useState({ nome: "", url: "" });
  const [cnpjPreview,setCnpjPreview]=useState(null),[lendoCnpj,setLendoCnpj]=useState(false);
  const lerCnpj=async(file)=>{if(!file)return;setLendoCnpj(true);const base64=await new Promise((ok)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]);r.readAsDataURL(file)});const out=await api(`/companies/${emp.id}/cnpj/extract`,{base64,mimetype:file.type});setLendoCnpj(false);if(out?.error)return aviso(out.error);setCnpjPreview(out);};
  const aplicarCnpj=()=>{setForm((f)=>({...f,...Object.fromEntries(Object.entries(cnpjPreview.dados||{}).filter(([,v])=>String(v||"").trim()))}));setCnpjPreview(null);aviso(t("reg.cnpjApplied"));};
  const pendencias = useMemo(() => camposPendentesEmpresa(form), [form]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const adicionarMaterial = () => {
    if (!material.nome.trim() || !/^https?:\/\//i.test(material.url)) return aviso(t("reg.materialUrlError"));
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
    if (!r || r.error) { aviso(r?.error || t("reg.saveError")); return false; }
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, ...payload } : c) }));
    aviso(t("reg.saved"));
    return true;
  };
  const enviar = async () => {
    if (!await salvar()) return;
    const r = await api(`/companies/${emp.id}/submit-review`, {});
    if (!r || r.error) return aviso(r?.pendencias?.join(", ") || r?.error || t("reg.submitError"));
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, statusCadastro: "em_analise" } : c) }));
    aviso(t("reg.submitted"));
  };
  const status = { rascunho: t("reg.statusDraft"), em_analise: t("reg.statusReview"), aprovada: t("reg.statusApproved"), suspensa: t("reg.statusSuspended") }[emp.statusCadastro] || t("reg.statusDraft");

  return <div className="vx-fade" style={{ maxWidth: 900 }}>
    <div className="vx-row" style={{ alignItems: "flex-start", gap: 16 }}>
      <div>
        <div className="vx-eyebrow">{t("reg.activation")}</div>
        <h2 className="vx-disp" style={{ fontSize: 24, margin: "5px 0" }}>{t("reg.title")}</h2>
        <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>{t("reg.desc")}</p>
      </div>
      <span className="vx-chip"><Building2 size={13} /> {status}</span>
    </div>

    <div className="vx-card" style={{ padding: 18, marginTop: 18 }}>
      <div className="vx-row" style={{marginBottom:14,flexWrap:"wrap"}}><div><b><FileScan size={15} style={{verticalAlign:-3,marginRight:6}}/>{t("reg.cnpjRead")}</b><div className="vx-mut" style={{fontSize:12}}>{t("reg.cnpjReadDesc")}</div></div><label className="vx-btn vx-btn-sm">{lendoCnpj?t("reg.reading"):t("reg.uploadCnpj")}<input hidden type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e)=>lerCnpj(e.target.files?.[0])}/></label></div>
      {cnpjPreview&&<div className="vx-notice" style={{marginBottom:14}}><b>{t("reg.cnpjPreview")} · {t("reg.confidence")} {cnpjPreview.confianca}</b><div className="vx-grid vx-g2" style={{marginTop:9}}>{Object.entries(cnpjPreview.dados||{}).map(([k,v])=><div key={k}><span className="vx-label">{k}</span><span>{v||t("reg.notFound")}</span></div>)}</div><button className="vx-btn vx-btn-primary vx-btn-sm" style={{marginTop:10}} onClick={aplicarCnpj}>{t("reg.confirmPreview")}</button></div>}
      <div className="vx-grid vx-g2">
        {campos.map(([k, label]) => <label key={k}><div className="vx-label" style={camposDestacados.includes(k) ? { color: "var(--amber)", fontWeight: 700 } : undefined}>{label}{camposDestacados.includes(k) ? ` · ${t("reg.neededForAI")}` : ""}</div><input className="vx-input" style={camposDestacados.includes(k) ? { borderColor: "var(--amber)" } : undefined} value={form[k] || ""} onChange={set(k)} /></label>)}
        <label><div className="vx-label">{t("reg.avgTicket")}</div><input className="vx-input" value={form.ticket || ""} onChange={set("ticket")} placeholder={t("reg.avgTicketPlaceholder")} /></label>
        <label><div className="vx-label" style={camposDestacados.includes("icp") ? { color: "var(--amber)", fontWeight: 700 } : undefined}>ICP{camposDestacados.includes("icp") ? ` · ${t("reg.neededForAI")}` : ""}</div><input className="vx-input" style={camposDestacados.includes("icp") ? { borderColor: "var(--amber)" } : undefined} value={form.icp || ""} onChange={set("icp")} placeholder={t("reg.icpPlaceholder")} /></label>
      </div>
      <label style={{ display: "block", marginTop: 14 }}><div className="vx-label" style={camposDestacados.includes("diferenciais") ? { color: "var(--amber)", fontWeight: 700 } : undefined}>{t("reg.differentiators")}{camposDestacados.includes("diferenciais") ? ` · ${t("reg.neededForAI")}` : ""}</div><textarea className="vx-input" style={{ minHeight: 76, ...(camposDestacados.includes("diferenciais") ? { borderColor: "var(--amber)" } : {}) }} value={form.diferenciais || ""} onChange={set("diferenciais")} /></label>
      <label style={{ display: "block", marginTop: 14 }}><div className="vx-label" style={camposDestacados.includes("objecoes") ? { color: "var(--amber)", fontWeight: 700 } : undefined}>{t("reg.commonObjections")}{camposDestacados.includes("objecoes") ? ` · ${t("reg.neededForAI")}` : ""}</div><textarea className="vx-input" style={{ minHeight: 76, ...(camposDestacados.includes("objecoes") ? { borderColor: "var(--amber)" } : {}) }} value={form.objecoes || ""} onChange={set("objecoes")} /></label>
    </div>

    <div className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row"><b><FileText size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{t("reg.salesMaterials")}</b><span className="vx-chip">{form.materiais?.length || 0}</span></div>
      <div className="vx-grid vx-g2" style={{ marginTop: 12 }}><input className="vx-input" placeholder={t("reg.materialName")} value={material.nome} onChange={(e) => setMaterial((m) => ({ ...m, nome: e.target.value }))} /><input className="vx-input" placeholder="https://..." value={material.url} onChange={(e) => setMaterial((m) => ({ ...m, url: e.target.value }))} /></div>
      <button className="vx-btn vx-btn-sm" style={{ marginTop: 9 }} onClick={adicionarMaterial}>{t("reg.addMaterial")}</button>
      {(form.materiais || []).map((m) => <div key={m.id} className="vx-row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}><a href={m.url} target="_blank" rel="noreferrer">{m.nome}</a><button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => setForm((f) => ({ ...f, materiais: f.materiais.filter((x) => x.id !== m.id) }))}>{ t("app.remove")}</button></div>)}
    </div>

    <div className="vx-card" style={{ padding: 16, marginTop: 16, borderColor: pendencias.length ? "var(--amber)" : "var(--brand)" }}>
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>{pendencias.length ? <CircleAlert size={18} color="var(--amber)" /> : <CheckCircle2 size={18} color="var(--brand)" />}<div><b>{pendencias.length ? t("reg.pendingCount", { count: pendencias.length }) : t("reg.readyForReview")}</b>{pendencias.length > 0 && <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 3 }}>{pendencias.join(" · ")}</div>}</div></div>
    </div>
    <div style={{ display: "flex", gap: 9, marginTop: 16 }}><button className="vx-btn vx-btn-primary" disabled={salvando} onClick={salvar}>{salvando ? t("app.saving") : t("reg.save")}</button><button className="vx-btn" disabled={pendencias.length > 0 || emp.statusCadastro === "aprovada"} onClick={enviar}><Send size={14} /> {t("reg.submitForReview")}</button></div>
  </div>;
}
