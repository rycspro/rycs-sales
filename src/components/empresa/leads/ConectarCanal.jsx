import { useEffect, useId, useState } from "react";
import { ShieldCheck, Smartphone, Instagram, Unplug, RefreshCw, Plus } from "lucide-react";
import { api, apiDelete, apiPatch } from "../../../lib/api.js";
import { carregarSdkMeta, abrirCadastroWhatsapp } from "../../../lib/metaSdk.js";

// Conexão do canal: aviso e aceite, botão da Meta e contas já ligadas.

const TEXTOS = {
  whatsapp: {
    empresa: "As conversas deste número serão guardadas na RYCS, vistas pela sua empresa e analisadas pela IA de auditoria, com os materiais que você cadastrou. Avise a sua equipe e os seus clientes na sua política de privacidade.",
    vendedor: "Só as conversas com os leads desta empresa são guardadas. A empresa lê essas conversas e a IA as audita. O resto do seu WhatsApp não é gravado nem visto por ninguém, e nada do que veio antes da conexão é pedido à Meta. Você pode desconectar quando quiser.",
  },
  instagram: { empresa: "Os directs e comentários deste perfil serão guardados na RYCS, vistos pela sua empresa e analisados pela IA de auditoria, com os materiais que você cadastrou." },
};

export default function ConectarCanal({ canal, papel = "empresa", info, aviso, recarregar, aberto, setAberto }) {
  const id = useId();
  const [aceite, setAceite] = useState(false);
  const [empresaId, setEmpresaId] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [sdk, setSdk] = useState(null);
  const conexoes = (info?.conexoes || []).filter((c) => c.canal === canal);
  const config = info?.[canal];
  const pronta = !!config?.configurada;
  const formAberto = aberto || conexoes.length === 0;

  useEffect(() => {
    if (canal !== "whatsapp" || !pronta || !formAberto || sdk) return;
    let vivo = true;
    carregarSdkMeta(config).then((FB) => { if (vivo) setSdk(FB); }).catch((e) => aviso?.(e.message));
    return () => { vivo = false; };
  }, [canal, pronta, formAberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const conectar = async () => {
    setOcupado(true);
    try {
      if (canal === "instagram") {
        const r = await api("/canais/instagram/iniciar", { consentimento: aceite });
        if (!r?.url) throw new Error(r?.error || "Não foi possível abrir o Instagram.");
        window.location.href = r.url;
        return;
      }
      const dados = await abrirCadastroWhatsapp(sdk, config);
      const r = await api("/canais/whatsapp/conectar", { ...dados, consentimento: aceite, companyId: empresaId || undefined });
      if (!r || r.error) throw new Error(r?.error || "Não foi possível conectar.");
      aviso?.(`WhatsApp ${r.numero || ""} conectado.`);
      setAberto?.(false); setAceite(false);
      recarregar?.();
    } catch (e) { aviso?.(e.message); }
    finally { setOcupado(false); }
  };

  const desconectar = async (c) => {
    if (!window.confirm(`Desconectar ${c.nome || c.numero}? As novas mensagens deixam de chegar. O histórico fica guardado.`)) return;
    const r = await apiDelete(`/canais/conexoes/${c.id}`, {});
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível desconectar.");
    aviso?.("Conta desconectada.");
    recarregar?.();
  };
  const alternarIA = async (c) => {
    const r = await apiPatch(`/canais/conexoes/${c.id}`, { auditoriaIA: !c.auditoriaIA });
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível salvar.");
    recarregar?.();
  };

  const Icone = canal === "instagram" ? Instagram : Smartphone;
  return (
    <section className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
      {conexoes.map((c) => (
        <div key={c.id} className="vx-row" style={{ flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>{canal === "instagram" ? `@${c.nome}` : c.nome || c.numero}</b>
            <div className="vx-mut" style={{ fontSize: 12 }}>
              {[canal === "whatsapp" && c.nome ? c.numero : "", c.vendedor ? `WhatsApp de ${c.vendedor}` : canal === "whatsapp" ? "Número da empresa" : ""].filter(Boolean).join(" · ")}
            </div>
            <div style={{ fontSize: 12, color: c.status === "ativa" ? "var(--green)" : "var(--red)" }}>{c.status === "ativa" ? "Conectado" : "Precisa conectar de novo"}{c.ultimoErro ? ` · ${c.ultimoErro}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(papel === "vendedor" || !c.sellerId) && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, minHeight: 44, cursor: "pointer" }}>
                <input type="checkbox" checked={c.auditoriaIA} onChange={() => alternarIA(c)} /> Auditoria automática da IA
              </label>
            )}
            <button type="button" className="vx-btn vx-btn-sm vx-btn-danger" style={{ minHeight: 44 }} onClick={() => desconectar(c)}><Unplug size={14} aria-hidden="true" /> Desconectar</button>
          </div>
        </div>
      ))}

      {!formAberto && (
        <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44, marginTop: 12 }} onClick={() => setAberto?.(true)}>
          <Plus size={14} aria-hidden="true" /> {canal === "instagram" ? "Conectar outro Instagram" : "Conectar outro número"}
        </button>
      )}

      {formAberto && (
        <div style={{ marginTop: conexoes.length ? 16 : 0 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--brand-50)", color: "var(--brand)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icone size={20} aria-hidden="true" /></span>
            <div style={{ minWidth: 0 }}>
              <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>{canal === "instagram" ? "Conecte o Instagram da empresa" : papel === "vendedor" ? "Conecte o seu WhatsApp Business" : "Conecte o WhatsApp da empresa"}</h2>
              <p className="vx-mut" style={{ fontSize: 13, lineHeight: 1.55, margin: "4px 0 0" }}>
                {canal === "instagram"
                  ? "Directs e comentários chegam aqui. A conta precisa ser profissional (empresa ou criador de conteúdo)."
                  : "Leia o QR code com o aplicativo WhatsApp Business do celular. Você continua usando o celular normalmente, e o que entra e sai por ele aparece aqui. O WhatsApp pessoal não é aceito pela Meta: mude para o WhatsApp Business antes (é grátis e mantém o número e as conversas)."}
              </p>
            </div>
          </div>

          {!pronta ? (
            <div className="vx-notice vx-notice-amber" style={{ marginTop: 14 }}>Esta conexão está em ativação com a Meta. Assim que a RYCS for liberada, o botão de conectar aparece aqui.</div>
          ) : (
            <>
              {papel === "vendedor" && (
                <div style={{ marginTop: 14 }}>
                  <label className="vx-label" htmlFor={`${id}-e`}>Empresa que você atende com este número</label>
                  <select id={`${id}-e`} className="vx-input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ minHeight: 44 }}>
                    <option value="">Escolha a empresa</option>
                    {(info?.empresas || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                  {info?.empresas?.length === 0 && <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>Você ainda não está aprovado em nenhuma empresa.</div>}
                </div>
              )}
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, fontSize: 13, lineHeight: 1.5, cursor: "pointer" }}>
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ marginTop: 3 }} />
                <span><ShieldCheck size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 4, color: "var(--brand)" }} />{TEXTOS[canal][papel] || TEXTOS[canal].empresa} <b>Li e concordo.</b></span>
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={conectar}
                  disabled={ocupado || !aceite || (papel === "vendedor" && !empresaId) || (canal === "whatsapp" && !sdk)}>
                  {ocupado ? <RefreshCw size={15} aria-hidden="true" /> : <Icone size={15} aria-hidden="true" />} {ocupado ? "Conectando…" : canal === "instagram" ? "Entrar com o Instagram" : "Conectar com QR code"}
                </button>
                {conexoes.length > 0 && <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={() => setAberto?.(false)}>Cancelar</button>}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
