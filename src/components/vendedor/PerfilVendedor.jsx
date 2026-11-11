import { canNavigate, useUnsavedChanges } from "../../lib/unsavedChanges.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Award, Camera, CheckCircle2, GraduationCap, Pencil, Trash2, X, RotateCcw } from "lucide-react";
import { api, apiPatch, apiDelete, API_URL } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { Medidor } from "../ui.jsx";
import { MODALIDADES, SEGMENTOS, DISPONIBILIDADES, SKILLS, LIMITES, GUIA_FOTO, exemploEnquadramento } from "../../../shared/fotoPerfil.js";
import { useI18n } from "../../lib/i18n.jsx";

const PERFIS = { sdr: "SDR", closer: "Closer", bdr: "BDR", pap: "PAP", "sem-exp": "Iniciante" };

function localizacao({ cidade = "", estado = "" }) {
  const c = String(cidade).trim();
  const e = String(estado).trim();
  if (!e) return c;
  if (!c) return e;
  return new RegExp(`\\b${e}\\b`, "i").test(c) ? c : `${c} · ${e}`;
}

function lerImagem(file) {
  return new Promise((ok, falha) => {
    const fr = new FileReader();
    fr.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
    fr.onload = () => {
      const dataUri = String(fr.result);
      const img = new Image();
      img.onerror = () => falha(new Error("O arquivo não é uma imagem válida."));
      img.onload = () => ok({
        base64: dataUri.split(",")[1],
        mimetype: file.type,
        largura: img.naturalWidth,
        altura: img.naturalHeight,
      });
      img.src = dataUri;
    };
    fr.readAsDataURL(file);
  });
}

function Marcadores({ opcoes, valor = [], onChange, max = 12 }) {
  const alternar = (v) => {
    const atual = valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v];
    if (atual.length <= max) onChange(atual);
  };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {opcoes.map((o) => {
        const on = valor.includes(o);
        return (
          <button key={o} type="button" className={"vx-chip" + (on ? " vx-badge-brand" : "")}
            onClick={() => alternar(o)}
            style={{ cursor: "pointer", borderColor: on ? "var(--brand)" : "var(--border)" }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

export default function PerfilVendedor({ eu, db, up, aviso, refazerAvaliacao, editarInicial = false }) {
  const { t } = useI18n();
  const [editando, setEditando] = useState(editarInicial);
  const [salvando, setSalvando] = useState(false);
  const [avaliacaoFoto, setAvaliacaoFoto] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [guiaAberto, setGuiaAberto] = useState(false);
  const arquivo = useRef(null);
  const [certificados, setCertificados] = useState([]);

  useEffect(() => { api("/courses/me/certificates").then((r) => setCertificados(r?.certificados || [])); }, []);

  const [form, setForm] = useState(() => ({
    nome: eu.nome || "", sobrenome: eu.sobrenome || "", titulo: eu.titulo || "", bio: eu.bio || "",
    pais: eu.pais || "Brasil", cidade: eu.cidade || "", estado: eu.estado || "", whats: eu.whats || "", dataNascimento: eu.dataNascimento || "",
    genero: eu.genero || "",
    experiencia: eu.experiencia || "", disponibilidade: eu.disponibilidade || "",
    segmentos: eu.segmentos || [], modalidades: eu.modalidades || [],
    regioes: eu.regioes || [], skills: eu.skills || [],
  }));

  const original = useRef(JSON.stringify(form));
  const dirty = editando && JSON.stringify(form) !== original.current;
  useUnsavedChanges(dirty);

  const stats = useMemo(() => {
    const meus = (db.submissions || []).filter((s) => s.sellerId === eu.id);
    const lib = meus.filter((s) => s.status === "liberado");
    const rec = meus.filter((s) => ["recusado", "ia_recusado"].includes(s.status));
    const decididas = lib.length + rec.length;
    return {
      total: meus.length, lib: lib.length, rec: rec.length,
      taxa: decididas ? Math.round((lib.length / decididas) * 100) : null,
      reunioes: lib.filter((s) => s.tipo === "realizada").length,
      vendas: lib.filter((s) => s.tipo === "venda").length,
    };
  }, [db, eu]);

  const aprovado = eu.status === "aprovado" || eu.status === "parcial";
  const nota = Number(eu.scoreTriagem) || 0;

  const salvar = async () => {
    if (!form.bio?.trim()) return aviso(t("seller.profile.bioRequired"));
    if (form.whats && !/^\d{10,13}$/.test(form.whats.replace(/\D/g, ''))) return aviso(t("seller.profile.invalidPhone"));
    setSalvando(true);
    const r = await apiPatch(`/sellers/${eu.id}`, form);
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || t("seller.profile.saveError"));
    original.current = JSON.stringify(form);
    up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, ...form } : s) }));
    setEditando(false);
    aviso(t("seller.profile.updated"));
  };

  const enviarFoto = async (file) => {
    if (!file) return;
    setAvaliacaoFoto(null);
    setEnviandoFoto(true);
    try {
      const img = await lerImagem(file);
      const r = await fetch(`${API_URL}/api/sellers/${eu.id}/foto`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(img),
      });
      const corpo = await r.json();
      setEnviandoFoto(false);

      if (!r.ok) {
        setAvaliacaoFoto(corpo.avaliacao || null);
        return aviso(corpo.error || t("seller.profile.photoError"));
      }
      setAvaliacaoFoto(corpo.avaliacao);
      up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, foto: corpo.foto, fotoScore: corpo.avaliacao.score } : s) }));
      aviso(t("seller.profile.photoApproved", { score: corpo.avaliacao.score }));
    } catch (err) {
      setEnviandoFoto(false);
      aviso(err.message);
    }
  };

  const removerFoto = async () => {
    const r = await apiDelete(`/sellers/${eu.id}/foto`);
    if (r?.error) return aviso(r.error);
    up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, foto: "", fotoScore: null } : s) }));
    setAvaliacaoFoto(null);
    aviso(t("seller.profile.photoRemoved"));
  };

  const campo = (chave, label, extra = {}) => (
    <label>
      <div className="vx-label">{label}</div>
      <input className="vx-input" value={form[chave]} maxLength={extra.max || 120}
        placeholder={extra.placeholder || ""}
        onChange={(e) => setForm({ ...form, [chave]: e.target.value })} />
    </label>
  );

  return (
    <div className="vx-fade">
      {/* ------------------------------------------------ cabeçalho ---- */}
      <div className="vx-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 84, height: 84, borderRadius: 20, overflow: "hidden",
              background: eu.foto ? "transparent" : "var(--brand)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 30,
              border: "1px solid var(--border)",
            }}>
              {eu.foto
                ? <img src={eu.foto} alt={`${t("seller.profile.photoOf")} ${eu.nome}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : String(eu.nome || "?").slice(0, 1).toUpperCase()}
            </div>
            <button className="vx-btn vx-btn-sm" onClick={() => setGuiaAberto(true)} disabled={enviandoFoto}
              style={{ position: "absolute", right: -6, bottom: -6, padding: "5px 7px", borderRadius: 999 }}
              title={t("seller.profile.changePhoto")}>
              <Camera size={13} />
            </button>
            <input ref={arquivo} hidden type="file" accept={LIMITES.tiposAceitos.join(",")}
              onChange={(e) => { enviarFoto(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="vx-disp" style={{ fontSize: 21 }}>{[eu.nome, eu.sobrenome].filter(Boolean).join(" ")}</div>
            <div style={{ fontSize: 13.5, color: "var(--brand)", fontWeight: 600 }}>
              {eu.titulo || `${PERFIS[eu.perfil] || t("seller.profile.professional")} ${t("seller.profile.commercial")}`}
            </div>
            <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>
              {localizacao(eu) || t("seller.profile.locationNotSet")}
            </div>
          </div>

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <span className={"vx-badge " + (aprovado ? "vx-badge-brand" : "vx-badge-red")}>
              {aprovado ? t("seller.profile.profileApproved") : t("seller.profile.profileNotApproved")}
              {nota > 0 && <> · {nota}%</>}
            </span>
            {refazerAvaliacao && (
              <button className="vx-btn vx-btn-sm" onClick={refazerAvaliacao}>
                <RotateCcw size={13} /> {nota > 0 ? t("seller.profile.retakeAssessment") : t("seller.profile.takeAssessment")}
              </button>
            )}
            <button className="vx-btn vx-btn-sm" onClick={() => { if (!editando || canNavigate()) setEditando(!editando); }}>
              {editando ? <><X size={13} /> {t("common.cancel")}</> : <><Pencil size={13} /> {t("seller.profile.editProfile")}</>}
            </button>
          </div>
        </div>

        {eu.bio && !editando && (
          <p className="vx-mut" style={{ fontSize: 13, marginTop: 14, marginBottom: 0, whiteSpace: "pre-wrap" }}>{eu.bio}</p>
        )}

        {enviandoFoto && <div className="vx-mut" style={{ fontSize: 12, marginTop: 10 }}>{t("seller.profile.verifyingPhoto")}</div>}
      </div>

      {guiaAberto && (
        <div className="vx-overlay" onClick={() => setGuiaAberto(false)}>
          <div className="vx-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="vx-row">
              <div>
                <div className="vx-eyebrow">{t("seller.profile.profilePhoto")}</div>
                <h2 className="vx-disp" style={{ margin: "4px 0", fontSize: 19 }}>{GUIA_FOTO.titulo}</h2>
              </div>
              <button className="vx-btn vx-btn-ghost" onClick={() => setGuiaAberto(false)}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", gap: 14, justifyContent: "center", margin: "14px 0 18px" }}>
              {["certo", "errado"].map((tp) => (
                <img key={tp} src={exemploEnquadramento(tp)} alt={tp === "certo" ? t("seller.profile.correctFraming") : t("seller.profile.incorrectFraming")}
                  style={{ width: 108, height: 108, borderRadius: 14 }} />
              ))}
            </div>

            <div className="vx-grid vx-g2">
              <div>
                <div className="vx-eyebrow" style={{ marginBottom: 6, color: "var(--brand)" }}>{t("seller.profile.recommended")}</div>
                <ul style={{ fontSize: 12.5, paddingLeft: 16, margin: 0, lineHeight: 1.7 }}>
                  {GUIA_FOTO.recomendado.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
              <div>
                <div className="vx-eyebrow" style={{ marginBottom: 6, color: "var(--red)" }}>{t("seller.profile.avoid")}</div>
                <ul className="vx-mut" style={{ fontSize: 12.5, paddingLeft: 16, margin: 0, lineHeight: 1.7 }}>
                  {GUIA_FOTO.evitar.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            </div>

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 7 }}>{t("seller.profile.technicalRequirements")}</div>
            <div className="vx-grid vx-g2">
              {GUIA_FOTO.requisitos.map((r) => (
                <div key={r.chave} style={{ fontSize: 12.5 }}>
                  <b>{r.texto}</b>
                  <div className="vx-mut" style={{ fontSize: 11.5 }}>{r.detalhe}</div>
                </div>
              ))}
            </div>

            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 18 }}
              onClick={() => { setGuiaAberto(false); arquivo.current?.click(); }}>
              <Camera size={14} /> {t("seller.profile.choosePhoto")}
            </button>
            <div className="vx-chart-source">
              {t("seller.profile.photoDisclaimer")}
            </div>
          </div>
        </div>
      )}

      {avaliacaoFoto && (
        <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
          <div className="vx-row">
            <div className="vx-eyebrow">{t("seller.profile.photoVerification")}</div>
            <span className={"vx-badge " + (avaliacaoFoto.aprovada ? "vx-badge-brand" : "vx-badge-amber")}>
              {avaliacaoFoto.score}/100 · {avaliacaoFoto.aprovada ? t("seller.profile.approved") : t("seller.profile.notApproved")}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            <Medidor value={avaliacaoFoto.score} tone={avaliacaoFoto.aprovada ? "brand" : "amber"} />
          </div>
          {!!avaliacaoFoto.problemas?.length && (
            <ul style={{ fontSize: 12.5, paddingLeft: 18, margin: "12px 0 0", color: "var(--amber)" }}>
              {avaliacaoFoto.problemas.map((p, i) => <li key={i} style={{ marginBottom: 3 }}><b>{p.titulo}:</b> {p.comoResolver}</li>)}
            </ul>
          )}
          {!!avaliacaoFoto.pendentesDeAnalise?.length && (
            <div style={{ marginTop: 12 }}>
              <div className="vx-eyebrow" style={{ marginBottom: 5 }}>{t("seller.profile.pendingImageAnalysis")}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {avaliacaoFoto.pendentesDeAnalise.map((p) => <span key={p} className="vx-chip">{p}</span>)}
              </div>
            </div>
          )}
          <div className="vx-chart-source">
            {avaliacaoFoto.observacao} {t("seller.profile.photoDisclaimerShort")}
          </div>
        </div>
      )}

      {/* -------------------------------------------------- edição ---- */}
      {editando && (
        <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
          <div className="vx-eyebrow">{t("seller.profile.commercialResume")}</div>
          <h3 className="vx-disp" style={{ fontSize: 17, margin: "3px 0 12px" }}>{t("seller.profile.yourInfo")}</h3>

          <div className="vx-grid vx-g2">
            {campo("nome", t("seller.profile.firstName"))}
            {campo("sobrenome", t("seller.profile.lastName"))}
          </div>
          <div className="vx-grid vx-g2" style={{ marginTop: 9 }}>
            {campo("titulo", t("seller.profile.professionalTitle"), { placeholder: "Closer B2B | SaaS | Energia" })}
            {campo("whats", "WhatsApp")}
          </div>
          <div className="vx-grid vx-g3" style={{ marginTop: 9 }}>
            {campo("pais", t("seller.profile.country"))}
            <label>
              <div className="vx-label">{t("seller.profile.state")}</div>
              <select className="vx-input" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="">{t("seller.profile.selectOption")}</option>
                {[["AC","Acre"],["AL","Alagoas"],["AM","Amazonas"],["AP","Amapá"],["BA","Bahia"],["CE","Ceará"],["DF","Distrito Federal"],["ES","Espírito Santo"],["GO","Goiás"],["MA","Maranhão"],["MG","Minas Gerais"],["MS","Mato Grosso do Sul"],["MT","Mato Grosso"],["PA","Pará"],["PB","Paraíba"],["PE","Pernambuco"],["PI","Piauí"],["PR","Paraná"],["RJ","Rio de Janeiro"],["RN","Rio Grande do Norte"],["RO","Rondônia"],["RR","Roraima"],["RS","Rio Grande do Sul"],["SC","Santa Catarina"],["SE","Sergipe"],["SP","São Paulo"],["TO","Tocantins"]].map(([uf, nome]) => (
                  <option key={uf} value={uf}>{uf} — {nome}</option>
                ))}
              </select>
            </label>
            {campo("cidade", t("seller.profile.city"))}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 9, flexWrap: "wrap" }}>
            <label>
              <div className="vx-label">{t("seller.profile.birthDate")}</div>
              <input type="date" className="vx-input" style={{ maxWidth: 200 }} value={form.dataNascimento}
                onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
            </label>
            <label>
              <div className="vx-label">{t("seller.profile.gender")}</div>
              <select className="vx-input" style={{ maxWidth: 180 }} value={form.genero}
                onChange={(e) => setForm({ ...form, genero: e.target.value })}>
                <option value="">{t("seller.profile.notSpecified")}</option>
                <option value="masculino">{t("seller.profile.male")}</option>
                <option value="feminino">{t("seller.profile.female")}</option>
              </select>
            </label>
          </div>

          <label style={{ display: "block", marginTop: 9 }}>
            <div className="vx-label">{t("seller.profile.bio")} *</div>
            <textarea className="vx-input" rows={4} maxLength={1200} value={form.bio}
              placeholder={t("seller.profile.bioPlaceholder")}
              onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <div className="vx-mut" style={{ fontSize: 11, textAlign: "right" }}>{form.bio.length}/1200</div>
          </label>

          <div style={{ marginTop: 12 }}>
            <div className="vx-label">{t("seller.profile.availability")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {DISPONIBILIDADES.map((d) => (
                <button key={d.chave} type="button"
                  className={"vx-chip" + (form.disponibilidade === d.chave ? " vx-badge-brand" : "")}
                  onClick={() => setForm({ ...form, disponibilidade: form.disponibilidade === d.chave ? "" : d.chave })}
                  style={{ cursor: "pointer", borderColor: form.disponibilidade === d.chave ? "var(--brand)" : "var(--border)" }}>
                  {d.nome}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="vx-label">{t("seller.profile.salesModalities")}</div>
            <Marcadores opcoes={MODALIDADES} valor={form.modalidades} onChange={(v) => setForm({ ...form, modalidades: v })} />
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="vx-label">{t("seller.profile.segments")}</div>
            <Marcadores opcoes={SEGMENTOS} valor={form.segmentos} onChange={(v) => setForm({ ...form, segmentos: v })} />
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="vx-label">{t("seller.profile.skills")}</div>
            <Marcadores opcoes={SKILLS} valor={form.skills} onChange={(v) => setForm({ ...form, skills: v })} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button className="vx-btn vx-btn-primary" disabled={salvando || !dirty} onClick={salvar}>
              {salvando ? t("common.saving") : t("seller.profile.saveProfile")}
            </button>
            {eu.foto && <button className="vx-btn vx-btn-danger" onClick={removerFoto}><Trash2 size={13} /> {t("seller.profile.removePhoto")}</button>}
          </div>
          <div className="vx-chart-source">
            {t("seller.profile.resumeDisclaimer")}
          </div>
        </div>
      )}

      {/* -------------------------------------------------- vitrine ---- */}
      {!editando && (
        <>
          {(eu.modalidades?.length || eu.segmentos?.length || eu.skills?.length) ? (
            <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
              {!!eu.modalidades?.length && <>
                <div className="vx-eyebrow" style={{ marginBottom: 6 }}>{t("seller.profile.modalities")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {eu.modalidades.map((m) => <span key={m} className="vx-chip">{m}</span>)}
                </div>
              </>}
              {!!eu.segmentos?.length && <>
                <div className="vx-eyebrow" style={{ marginBottom: 6 }}>{t("seller.profile.segmentsLabel")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {eu.segmentos.map((m) => <span key={m} className="vx-chip">{m}</span>)}
                </div>
              </>}
              {!!eu.skills?.length && <>
                <div className="vx-eyebrow" style={{ marginBottom: 6 }}>{t("seller.profile.skillsLabel")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {eu.skills.map((m) => <span key={m} className="vx-chip">{m}</span>)}
                </div>
              </>}
            </div>
          ) : (
            <div className="vx-card" style={{ padding: 18, marginTop: 12, textAlign: "center" }}>
              <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>
                {t("seller.profile.emptyResume")}
              </p>
            </div>
          )}

          <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
            <div className="vx-row" style={{ marginBottom: 10 }}>
              <div className="vx-eyebrow">
                <GraduationCap size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> {t("seller.profile.academyCerts")}
              </div>
              <span className="vx-chip vx-mono">{certificados.length}</span>
            </div>
            {!certificados.length ? (
              <p className="vx-mut" style={{ fontSize: 12.5, margin: 0 }}>
                {t("seller.profile.noCertsYet")}
              </p>
            ) : (
              <div className="vx-grid vx-g2">
                {certificados.map((c) => (
                  <div key={c.codigo} style={{ padding: 13, border: "1px solid var(--border)", borderRadius: 12, borderLeft: "3px solid var(--brand)" }}>
                    <div className="vx-row" style={{ gap: 8 }}>
                      <b style={{ fontSize: 13 }}>{c.titulo}</b>
                      <span className="vx-badge vx-badge-brand vx-mono" style={{ flexShrink: 0 }}>{c.percentual}%</span>
                    </div>
                    <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>{c.categoria} · {dataCurta(c.emitidoEm)}</div>
                    <div className="vx-mono" style={{ fontSize: 11.5, marginTop: 5, color: "var(--brand)" }}>{c.codigo}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="vx-card" style={{ padding: 20, marginTop: 12 }}>
            <div className="vx-eyebrow" style={{ marginBottom: 10 }}>
              <Award size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> {t("seller.profile.platformHistory")}
            </div>
            <div className="vx-grid vx-g4">
              {[[t("seller.profile.actionsSent"), stats.total], [t("seller.profile.actionsApproved"), stats.lib],
                [t("seller.profile.meetingsHeld"), stats.reunioes], [t("seller.profile.sales"), stats.vendas]].map(([k, v]) => (
                <div key={k}>
                  <div className="vx-eyebrow" style={{ marginBottom: 4 }}>{k}</div>
                  <div className="vx-disp vx-mono" style={{ fontSize: 21 }}>{v}</div>
                </div>
              ))}
            </div>
            <hr className="vx-sep" />
            <div className="vx-row" style={{ fontSize: 13, marginBottom: 5 }}>
              <span className="vx-mut">{t("seller.profile.approvalRate")}</span>
              <b className="vx-mono">{stats.taxa === null ? "—" : `${stats.taxa}%`}</b>
            </div>
            {stats.taxa !== null && <Medidor value={stats.taxa} tone={stats.taxa >= 70 ? "brand" : stats.taxa >= 50 ? "amber" : "red"} />}
            <div className="vx-chart-source">
              {t("seller.profile.approvalRateNote")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
