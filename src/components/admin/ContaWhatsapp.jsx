import { useEffect, useId, useState } from "react";
import { api } from "../../lib/api.js";
import { VERTICAIS_WHATSAPP, LIMITES_PERFIL_WHATSAPP as L, validarPerfilWhatsapp } from "../../../shared/whatsappPerfil.js";
import { categoria, STATUS_MODELO, QUALIDADE, LIMITE, PODE_ENVIAR, QUEM_PAGA, Selo, ErroMeta } from "./whatsappFormato.jsx";

// Tudo o que a Meta deixa ver e mudar da conta do WhatsApp da RYCS, num lugar só.
// O que só dá para mudar no painel da Meta (cartão, token, publicar o app) vem como link.

const ROTULO = {
  APPROVED: "Aprovado", PENDING_REVIEW: "Em análise", PENDING: "Em análise", DECLINED: "Recusado", REJECTED: "Recusado",
  AVAILABLE_WITHOUT_REVIEW: "Disponível", NONE: "—", verified: "Verificado", unverified: "Não verificado", pending: "Em análise",
  rejected: "Recusado", not_verified: "Não verificado", CONNECTED: "Conectado", DISCONNECTED: "Desconectado", FLAGGED: "Sinalizado",
  RESTRICTED: "Restrito", BANNED: "Banido", VERIFIED: "Verificado", NOT_VERIFIED: "Não verificado", EXPIRED: "Expirado",
  LIVE: "Produção", SANDBOX: "Teste", CLOUD_API: "Cloud API", STANDARD: "Padrão", HIGH: "Alta",
};
const r = (v) => (v == null || v === "" ? "—" : ROTULO[v] || String(v));

function Linha({ rotulo, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 40%) 1fr", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <span className="vx-mut">{rotulo}</span><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

function Saude({ h }) {
  if (!h) return "—";
  const problemas = (h.entities || []).flatMap((e) => (e.errors || []).map((x) => ({ ...x, tipo: e.entity_type })));
  return (
    <>
      <Selo par={PODE_ENVIAR[h.can_send_message] || [r(h.can_send_message), "var(--muted)"]} />
      {problemas.map((p, i) => (
        <div key={i} style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          <b>{p.tipo}</b>: {p.error_description}{p.possible_solution ? <span className="vx-mut"> · Como resolver: {p.possible_solution}</span> : null}
        </div>
      ))}
    </>
  );
}

function Cartao({ titulo, children, extra }) {
  return (
    <div className="vx-card" style={{ padding: 18 }}>
      <div className="vx-row" style={{ gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <div className="vx-disp" style={{ fontSize: 15 }}>{titulo}</div>{extra}
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export default function ContaWhatsapp({ aviso }) {
  const [d, setD] = useState(null);
  const carregar = () => api("/admin/whatsapp/conta").then((x) => setD(x && !x.error ? x : { erro: x?.error || "Não foi possível consultar a Meta." }));
  useEffect(() => { carregar(); }, []);

  if (!d) return <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Consultando a Meta...</div>;
  if (d.erro) return <div className="vx-card" style={{ padding: 18 }}><ErroMeta erro={d.erro} /></div>;

  const n = d.numero.ok ? d.numero.dados : null;
  const c = d.conta.ok ? d.conta.dados : null;
  const modelos = d.modelos.ok ? d.modelos.dados : [];
  const porStatus = modelos.reduce((acc, m) => ({ ...acc, [m.status]: (acc[m.status] || 0) + 1 }), {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Cartao titulo="Número" extra={<button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44, marginLeft: "auto" }} onClick={() => { setD(null); carregar(); }}>Atualizar</button>}>
        {!n ? <ErroMeta erro={d.numero.erro} /> : (<>
          <Linha rotulo="Número">{n.display_phone_number || "—"}</Linha>
          <Linha rotulo="Nome exibido">{n.verified_name || "—"} <span className="vx-mut">({r(n.name_status)})</span></Linha>
          <Linha rotulo="Pode enviar agora?"><Saude h={n.health_status} /></Linha>
          <Linha rotulo="Qualidade do número"><Selo par={QUALIDADE[n.quality_rating || ""] || [r(n.quality_rating), "var(--muted)"]} />
            <span className="vx-mut" style={{ fontSize: 12 }}> · cai quando muita gente bloqueia ou denuncia</span></Linha>
          <Linha rotulo="Limite de envio da Meta">{LIMITE[n.messaging_limit_tier] || r(n.messaging_limit_tier)}<span className="vx-mut" style={{ fontSize: 12 }}> · pessoas diferentes por 24h em conversas iniciadas pela RYCS</span></Linha>
          <Linha rotulo="Vazão">{r(n.throughput?.level)}</Linha>
          <Linha rotulo="Situação">{r(n.status)} · {r(n.platform_type)} · {r(n.account_mode)}</Linha>
          <Linha rotulo="Verificação do número">{r(n.code_verification_status)}</Linha>
          <Linha rotulo="Selo de conta oficial">{n.is_official_business_account ? "Sim" : "Não"}</Linha>
        </>)}
      </Cartao>

      <Cartao titulo="Conta e cobrança">
        {!c ? <ErroMeta erro={d.conta.erro} /> : (<>
          <Linha rotulo="Conta">{c.name || "—"}</Linha>
          <Linha rotulo="Pode enviar agora?"><Saude h={c.health_status} /></Linha>
          <Linha rotulo="Verificação do negócio">{r(c.business_verification_status)}</Linha>
          <Linha rotulo="Revisão da conta">{r(c.account_review_status)}</Linha>
          <Linha rotulo="Quem paga">{QUEM_PAGA[c.ownership_type] || r(c.ownership_type)}</Linha>
          <Linha rotulo="Moeda da cobrança">{c.currency || "—"}</Linha>
          <Linha rotulo="Forma de pagamento">{c.primary_funding_id ? `ativa na Meta (código ${c.primary_funding_id})` : "a Meta não informa pela API"}</Linha>
          <Linha rotulo="Estatísticas de modelos">{c.is_enabled_for_insights == null ? "—" : c.is_enabled_for_insights ? "Ligadas" : "Desligadas (ligue em Custos e cliques)"}</Linha>
          <Linha rotulo="Fuso da conta">{c.timezone_id ?? "—"}</Linha>
        </>)}
      </Cartao>

      <Perfil inicial={d.perfil} aviso={aviso} />

      <Cartao titulo="Modelos na Meta" extra={<span className="vx-mut" style={{ fontSize: 12.5 }}>{Object.entries(porStatus).map(([s, q]) => `${q} ${(STATUS_MODELO[s]?.[0] || s).toLowerCase()}`).join(" · ")}</span>}>
        {!d.modelos.ok ? <ErroMeta erro={d.modelos.erro} /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: "left", color: "var(--muted)" }}>
                {["Modelo", "Idioma", "Categoria", "Situação", "Qualidade", "Observação"].map((h) => <th key={h} scope="col" style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{h}</th>)}
              </tr></thead>
              <tbody>{modelos.map((m) => (
                <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <th scope="row" style={{ padding: 8, fontWeight: 500, textAlign: "left" }}>{m.nome}</th>
                  <td style={{ padding: 8 }}>{m.idioma}</td>
                  <td style={{ padding: 8 }}>{categoria(m.categoria)}</td>
                  <td style={{ padding: 8 }}><Selo par={STATUS_MODELO[m.status] || [m.status, "var(--muted)"]} /></td>
                  <td style={{ padding: 8 }}><Selo par={QUALIDADE[m.qualidade] || [m.qualidade || "—", "var(--muted)"]} /></td>
                  <td style={{ padding: 8, fontSize: 12 }} className="vx-mut">
                    {m.motivo ? `Motivo: ${m.motivo}. ` : ""}{m.categoriaAnterior ? `A Meta mudou de ${categoria(m.categoriaAnterior)} para ${categoria(m.categoria)}.` : ""}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Webhook (avisos da Meta para a RYCS)">
        {!d.apps.ok ? <ErroMeta erro={d.apps.erro} /> : d.apps.dados.length === 0
          ? <div style={{ fontSize: 13, color: "var(--red)" }}>Nenhum app recebe os avisos desta conta. Sem isso, entrega, leitura e respostas não chegam.</div>
          : d.apps.dados.map((a) => <Linha key={a.id || a.name} rotulo="App que recebe os avisos">{a.name || a.id}</Linha>)}
      </Cartao>

      <Cartao titulo="Freios do disparo (proteção da conta)">
        <Linha rotulo="Pessoas por 24h">{d.freios.limite24h} (restam {d.freios.vagas24h} agora)</Linha>
        <Linha rotulo="Rodada">padrão {d.freios.lotePadrao}, máximo {d.freios.loteMaximo}</Linha>
        <Linha rotulo="Horário de envio">das {d.freios.horario.inicio}h às {d.freios.horario.fim}h no horário de quem recebe</Linha>
        <Linha rotulo="Para sozinho quando">a Meta avisa de bloqueios (erro 131048) ou 30% das mensagens falham</Linha>
        <Linha rotulo="Bloqueio da Meta nas últimas 24h">{d.freios.bloqueioRecente ? <b style={{ color: "var(--red)" }}>Sim, disparos pausados</b> : "Não"}</Linha>
      </Cartao>

      <Cartao titulo="No painel da Meta">
        <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 6px", lineHeight: 1.5 }}>O que a API não deixa ver nem mudar daqui: cartão e faturas, token do servidor, publicação do app e criação de modelos de autenticação.</p>
        {d.links.map((l) => <div key={l.url} style={{ padding: "6px 0", fontSize: 13 }}><a href={l.url} target="_blank" rel="noreferrer">{l.rotulo}</a></div>)}
      </Cartao>
    </div>
  );
}

function Perfil({ inicial, aviso }) {
  const id = useId();
  const p0 = inicial?.ok ? inicial.dados : null;
  const [f, setF] = useState(() => ({
    about: p0?.about || "", description: p0?.description || "", address: p0?.address || "", email: p0?.email || "",
    site1: p0?.websites?.[0] || "", site2: p0?.websites?.[1] || "", vertical: p0?.vertical || "UNDEFINED",
  }));
  const [salvando, setSalvando] = useState(false);
  const mudar = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (!p0) return <Cartao titulo="Perfil público do WhatsApp"><ErroMeta erro={inicial?.erro} /></Cartao>;

  const salvar = async (e) => {
    e.preventDefault();
    const dados = { about: f.about, description: f.description, address: f.address, email: f.email, websites: [f.site1, f.site2], vertical: f.vertical };
    const v = validarPerfilWhatsapp(dados);
    if (v.erro) return aviso?.(v.erro);
    setSalvando(true);
    const resp = await api("/admin/whatsapp/perfil", dados);
    setSalvando(false);
    aviso?.(resp?.error || "Perfil atualizado no WhatsApp.");
  };

  const campo = (k, rotulo, max, area) => (
    <div>
      <label className="vx-label" htmlFor={`${id}-${k}`}>{rotulo}{max ? ` (até ${max})` : ""}</label>
      {area
        ? <textarea id={`${id}-${k}`} className="vx-input" rows={3} maxLength={max} value={f[k]} onChange={mudar(k)} />
        : <input id={`${id}-${k}`} className="vx-input" maxLength={max} value={f[k]} onChange={mudar(k)} style={{ minHeight: 44 }} />}
    </div>
  );

  return (
    <Cartao titulo="Perfil público do WhatsApp">
      <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 10px", lineHeight: 1.5 }}>O que aparece quando a pessoa toca no nome RYCS no WhatsApp. A foto e o nome exibido só mudam no painel da Meta.</p>
      {p0.profile_picture_url && <img src={p0.profile_picture_url} alt="Foto do perfil do WhatsApp da RYCS" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", marginBottom: 10 }} />}
      <form onSubmit={salvar} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12 }}>
        {campo("about", "Recado (sobre)", L.about)}
        {campo("email", "E-mail", L.email)}
        {campo("description", "Descrição", L.description, true)}
        {campo("address", "Endereço", L.address, true)}
        {campo("site1", "Site 1", L.website)}
        {campo("site2", "Site 2", L.website)}
        <div>
          <label className="vx-label" htmlFor={`${id}-vertical`}>Categoria do negócio</label>
          <select id={`${id}-vertical`} className="vx-input" value={f.vertical} onChange={mudar("vertical")} style={{ minHeight: 44 }}>
            {VERTICAIS_WHATSAPP.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button type="submit" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} disabled={salvando}>{salvando ? "Salvando…" : "Salvar no WhatsApp"}</button>
        </div>
      </form>
    </Cartao>
  );
}
