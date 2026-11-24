import { useEffect, useId, useState } from "react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";

const NOMES_PASSO = {
  "onboarding:boas_vindas": "Dia 0 · Bem-vindo",
  "onboarding:perfil_falta": "Dia 1 · Falta pouco pro perfil",
  "onboarding:oportunidade": "Dia 2 · Primeira oportunidade",
  "onboarding:aviso_inativacao": "Dia 3 · Lembrete de perfil",
  "indicacoes:indique": "Dia 4 · Indique 10 profissionais",
  "indicacoes:codigo_nao_usado": "Dia 5 · Código não usado",
  "graduacao:academy": "Dia 6 · Sales Academy",
  "graduacao:planos": "Dia 7 · Pro x Premium",
  "repescagem:precisa": "Parado 5 dias · Precisamos de você",
  "repescagem:novas": "+3 dias · Empresas novas",
  "repescagem:ultima": "+4 dias · Última chamada",
};
// Regra de envio de cada passo, por extenso (shared/sequenciasEmail.js).
const QUANDO = {
  "onboarding:boas_vindas": "Logo após o cadastro (dia 0 ou 1).",
  "onboarding:perfil_falta": "A partir do dia 1, só se o perfil ainda não estiver completo.",
  "onboarding:oportunidade": "A partir do dia 2.",
  "onboarding:aviso_inativacao": "A partir do dia 3, só se o perfil ainda não estiver completo. A conta continua ativa.",
  "indicacoes:indique": "A partir do dia 4, com o perfil completo.",
  "indicacoes:codigo_nao_usado": "A partir do dia 5, se ninguém usou o código de indicação.",
  "graduacao:academy": "A partir do dia 6.",
  "graduacao:planos": "A partir do dia 7, só para quem está no plano Grátis.",
  "repescagem:precisa": "A partir do dia 8, depois de 5 dias sem usar a plataforma.",
  "repescagem:novas": "3 dias depois do anterior, se continuar parado.",
  "repescagem:ultima": "4 dias depois do anterior, se continuar parado.",
};
const quandoPasso = (k) => QUANDO[k] || (k.startsWith("empresas_offline:d") ? `Empresa sem atividade há ${4 + Number(k.split(":d")[1])} dias (1 e-mail por dia, 7 no total).` : "");
const GRUPOS = [
  ["onboarding", "Onboarding · profissional"], ["indicacoes", "Indicações · profissional"], ["graduacao", "Graduação · profissional"],
  ["repescagem", "Repescagem · profissional"],
];

// Prévia que se ajusta à altura do e-mail (sem scripts: só lê a altura).
function PreviaEmail({ html, titulo }) {
  const [altura, setAltura] = useState(560);
  return (
    <iframe title={titulo} srcDoc={html} sandbox="allow-same-origin"
      onLoad={(e) => { try { setAltura(e.currentTarget.contentDocument.documentElement.scrollHeight + 8); } catch { /* mantém */ } }}
      style={{ width: "100%", height: altura, border: "1px solid var(--border)", borderRadius: 10, marginTop: 8, background: "#fff" }} />
  );
}

// Contagem por e-mail a partir da lista de destinatários.
function contagemPorPasso(destinatarios) {
  const c = {};
  const soma = (k, campo) => { c[k] = c[k] || { recebeu: 0, falhou: 0, fila: 0, espera: 0 }; c[k][campo]++; };
  for (const d of destinatarios || []) {
    for (const e of d.envios) if (e.status !== "pulado" && e.status !== "enviando") soma(e.chave, e.status === "enviado" ? "recebeu" : "falhou");
    if (d.proximo) soma(d.proximo.chave, d.proximo.status === "na_fila" ? "fila" : "espera");
  }
  return c;
}

// Todos os e-mails da sequência, em ordem, com a regra de envio e a prévia real.
function SequenciaCompleta({ chaves, idioma, contagem }) {
  const [previas, setPrevias] = useState({});
  useEffect(() => {
    let vivo = true;
    setPrevias({});
    (async () => {
      for (const k of chaves) {
        const r = await api("/admin/sequencias-email/previa", { chave: k, idioma });
        if (!vivo) return;
        setPrevias((p) => ({ ...p, [k]: r && !r.error ? r : { erro: true } }));
      }
    })();
    return () => { vivo = false; };
  }, [chaves, idioma]);

  return GRUPOS.map(([g, titulo]) => {
    const doGrupo = chaves.filter((k) => k.startsWith(`${g}:`));
    if (!doGrupo.length) return null;
    return (
      <div key={g} style={{ marginTop: 18 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 8 }}>{titulo}</div>
        {doGrupo.map((k) => {
          const pv = previas[k];
          return (
            <div key={k} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <b style={{ fontSize: 14 }}>{nomePasso(k)}</b>
                <span className="vx-mut" style={{ fontSize: 12.5 }}>{quandoPasso(k)}</span>
              </div>
              {contagem && (() => {
                const n = contagem[k] || { recebeu: 0, falhou: 0, fila: 0, espera: 0 };
                return (
                  <div style={{ fontSize: 12.5, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span><b>{n.recebeu}</b> receberam</span>
                    <span><b>{n.fila}</b> na fila agora</span>
                    {n.espera > 0 && <span><b>{n.espera}</b> aguardando o intervalo de 20h</span>}
                    {n.falhou > 0 && <span style={{ color: "var(--red)" }}><b>{n.falhou}</b> falharam</span>}
                    {n.recebeu === 0 && <span className="vx-mut">Ainda não disparado</span>}
                  </div>
                );
              })()}
              {!pv ? <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 8 }}>Carregando prévia…</div>
                : pv.erro ? <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 8 }}>Prévia indisponível.</div>
                : (<>
                  <div style={{ fontSize: 13, marginTop: 6 }}><span className="vx-mut">Assunto:</span> <b>{pv.assunto}</b></div>
                  <PreviaEmail html={pv.html} titulo={`Prévia: ${nomePasso(k)}`} />
                </>)}
            </div>
          );
        })}
      </div>
    );
  });
}

const NOME_SEQ = { onboarding: "Onboarding", indicacoes: "Indicações", graduacao: "Graduação", repescagem: "Repescagem", empresas_offline: "Empresa parada (desligada)", reativacao_empresas: "Reativação de empresas" };
// Fase da pessoa no funil: a do próximo e-mail ou, sem próximo, a do último recebido.
function faseDe(d) {
  if (d.descadastrado) return "Descadastrado";
  if (d.inativo) return "Conta inativa";
  const k = d.proximo?.chave || [...d.envios].reverse().find((e) => e.status === "enviado")?.chave;
  const base = k ? NOME_SEQ[k.split(":")[0]] || "" : "Sem e-mail previsto";
  if (d.tipo !== "vendedor" || d.perfilCompleto == null) return base;
  return `${base} · perfil ${d.perfilCompleto ? "completo" : "incompleto"}`;
}

const pctTxt = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const KPIS = [
  ["enviados", "Enviados", null],
  ["taxaEntrega", "Entrega", "entregues"],
  ["taxaAbertura", "Abertura", "abertos"],
  ["taxaClique", "Cliques", "clicados"],
  ["taxaCliqueSobreAbertura", "Clique / abertura", null],
  ["taxaDevolucao", "Devolução", "devolvidos"],
  ["taxaSpam", "Marcado como spam", "spam"],
  ["taxaDescadastro", "Descadastro", "descadastros"],
];

// Desempenho dos e-mails: taxas no total e por e-mail da sequência.
function Metricas({ m, ordem, onSincronizar, sincronizando }) {
  if (!m) return <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>Carregando métricas…</div>;
  const passos = ordem.filter((k) => m.passos[k]);
  return (
    <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="vx-row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div className="vx-disp" style={{ fontSize: 15 }}>Desempenho dos e-mails</div>
          <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
            Abertura e cliques são sobre os entregues. Abertura é aproximada: alguns aplicativos (como o Mail do iPhone) abrem as imagens sozinhos.
            {m.ultimoEvento ? ` Último evento do Resend: ${dataCurta(m.ultimoEvento)}.` : ""}
          </div>
        </div>
        <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={onSincronizar} disabled={sincronizando}>
          {sincronizando ? "Atualizando…" : "Atualizar pelo Resend"}
        </button>
      </div>
      {!m.webhookConfigurado && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid var(--amber)", fontSize: 12.5, lineHeight: 1.6 }}>
          <b>Falta ligar o webhook do Resend</b> para entrega, abertura e clique chegarem sozinhos. Enquanto isso, use "Atualizar pelo Resend".
          No Resend: Webhooks → Add endpoint → <span className="vx-mono">https://app.rycs.pro/api/webhooks/resend</span>, com todos os eventos de e-mail;
          copie o Signing secret e salve no GitHub como o segredo <span className="vx-mono">RESEND_WEBHOOK_SECRET</span>. Em Domains, ligue Open tracking e Click tracking.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 10, marginTop: 14 }}>
        {KPIS.map(([k, rotulo, qtd]) => (
          <div key={k} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
            <div className="vx-mut" style={{ fontSize: 12 }}>{rotulo}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{k === "enviados" ? m.total.enviados : pctTxt(m.total[k])}</div>
            {qtd && <div className="vx-mut" style={{ fontSize: 11.5 }}>{m.total[qtd]} {qtd === "abertos" ? "abriram" : qtd === "clicados" ? "clicaram" : ""}</div>}
          </div>
        ))}
      </div>
      {passos.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "right", color: "var(--muted)" }}>
                <th scope="col" style={{ textAlign: "left", padding: "6px 8px" }}>E-mail</th>
                {KPIS.map(([k, rotulo]) => <th key={k} scope="col" style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{rotulo}</th>)}
              </tr>
            </thead>
            <tbody>
              {passos.map((k) => (
                <tr key={k} style={{ borderTop: "1px solid var(--border)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  <th scope="row" style={{ textAlign: "left", fontWeight: 500, padding: "8px", whiteSpace: "nowrap" }}>{nomePasso(k)}</th>
                  {KPIS.map(([c]) => <td key={c} style={{ padding: "8px" }}>{c === "enviados" ? m.passos[k].enviados : pctTxt(m.passos[k][c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {m.linksMaisClicados?.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 12.5 }}>
          <b>Links mais clicados</b>
          {m.linksMaisClicados.map((l) => (
            <div key={l.link} className="vx-row" style={{ gap: 10, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.link}</span>
              <span className="vx-mono">{l.cliques}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SITUACOES = [
  ["todos", "Todos"], ["recebeu", "Já recebeu algum"], ["nenhum", "Ainda não recebeu nenhum"],
  ["abriu", "Abriu algum"], ["clicou", "Clicou em algum"], ["naoabriu", "Recebeu e não abriu"], ["fila", "Com e-mail na fila"], ["falhou", "Com falha"], ["descadastrado", "Descadastrados"], ["inativo", "Contas inativas"],
];

// Quem recebeu o quê, quem ainda não recebeu e o próximo e-mail de cada pessoa.
function Destinatarios({ lista }) {
  const id = useId();
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [situacao, setSituacao] = useState("todos");
  const [passo, setPasso] = useState("");
  const [limite, setLimite] = useState(50);
  if (!lista) return <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>Carregando destinatários…</div>;

  const q = busca.trim().toLowerCase();
  const filtrada = lista.filter((d) => {
    if (tipo !== "todos" && d.tipo !== tipo) return false;
    if (q && !`${d.nome} ${d.email}`.toLowerCase().includes(q)) return false;
    const recebidos = d.envios.filter((e) => e.status === "enviado");
    if (situacao === "recebeu" && !recebidos.length) return false;
    if (situacao === "nenhum" && recebidos.length) return false;
    if (situacao === "fila" && d.proximo?.status !== "na_fila") return false;
    if (situacao === "abriu" && !d.envios.some((e) => e.aberto)) return false;
    if (situacao === "clicou" && !d.envios.some((e) => e.clicado)) return false;
    if (situacao === "naoabriu" && (!recebidos.length || d.envios.some((e) => e.aberto))) return false;
    if (situacao === "falhou" && !d.envios.some((e) => e.status === "falhou")) return false;
    if (situacao === "descadastrado" && !d.descadastrado) return false;
    if (situacao === "inativo" && !d.inativo) return false;
    if (passo && !recebidos.some((e) => e.chave === passo)) return false;
    return true;
  });
  const total = (f) => lista.filter(f).length;

  return (
    <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="vx-disp" style={{ fontSize: 15 }}>Quem recebeu</div>
      <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>
        {lista.length} pessoas · {total((d) => d.envios.some((e) => e.status === "enviado"))} já receberam algum e-mail ·{" "}
        {total((d) => !d.envios.some((e) => e.status === "enviado"))} ainda não receberam nenhum ·{" "}
        {total((d) => d.proximo?.status === "na_fila")} com e-mail na fila
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
        <label style={{ flex: "1 1 200px" }}>
          <span className="vx-label" id={`${id}-b`}>Buscar</span>
          <input className="vx-input" aria-labelledby={`${id}-b`} placeholder="Nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ minHeight: 44 }} />
        </label>
        <label style={{ flex: "0 1 160px" }}>
          <span className="vx-label" id={`${id}-t`}>Público</span>
          <select className="vx-input" aria-labelledby={`${id}-t`} value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ minHeight: 44 }}>
            <option value="todos">Todos</option><option value="vendedor">Profissionais</option><option value="empresa">Empresas</option>
          </select>
        </label>
        <label style={{ flex: "0 1 210px" }}>
          <span className="vx-label" id={`${id}-s`}>Situação</span>
          <select className="vx-input" aria-labelledby={`${id}-s`} value={situacao} onChange={(e) => setSituacao(e.target.value)} style={{ minHeight: 44 }}>
            {SITUACOES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ flex: "0 1 230px" }}>
          <span className="vx-label" id={`${id}-p`}>Recebeu o e-mail</span>
          <select className="vx-input" aria-labelledby={`${id}-p`} value={passo} onChange={(e) => setPasso(e.target.value)} style={{ minHeight: 44 }}>
            <option value="">Qualquer</option>
            {Object.keys(NOMES_PASSO).map((k) => <option key={k} value={k}>{NOMES_PASSO[k]}</option>)}
          </select>
        </label>
      </div>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th scope="col" style={{ padding: "6px 8px" }}>Pessoa</th>
              <th scope="col" style={{ padding: "6px 8px" }}>Fase</th>
              <th scope="col" style={{ padding: "6px 8px" }}>E-mails recebidos</th>
              <th scope="col" style={{ padding: "6px 8px" }}>Próximo</th>
            </tr>
          </thead>
          <tbody>
            {filtrada.slice(0, limite).map((d) => (
              <tr key={`${d.tipo}:${d.id}`} style={{ borderTop: "1px solid var(--border)", verticalAlign: "top" }}>
                <td style={{ padding: "8px", minWidth: 180 }}>
                  <b>{d.nome || "Sem nome"}</b> <span className="vx-mut">· {d.tipo === "empresa" ? "Empresa" : "Profissional"}</span>
                  <div className="vx-mut" style={{ wordBreak: "break-all" }}>{d.email}</div>
                  {(d.descadastrado || d.inativo) && (
                    <div style={{ color: "var(--red)", marginTop: 2 }}>{d.descadastrado ? "Descadastrado" : "Conta inativa (perfil incompleto)"}</div>
                  )}
                </td>
                <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{faseDe(d)}</td>
                <td style={{ padding: "8px" }}>
                  {d.envios.length === 0 ? <span className="vx-mut">Nenhum ainda</span> : (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {d.envios.map((e, i) => (
                        <span key={i} title={e.erro || ""} style={{
                          padding: "2px 8px", borderRadius: 999, fontSize: 11.5, whiteSpace: "nowrap",
                          border: `1px solid ${e.status === "enviado" ? "var(--border)" : "var(--red)"}`,
                          color: e.status === "enviado" ? "var(--ink)" : "var(--red)",
                        }}>
                          {nomePasso(e.chave)} · {e.status !== "enviado" ? "falhou"
                            : e.spam ? "marcou como spam" : e.devolvido ? "devolvido" : e.clicado ? "clicou" : e.aberto ? "abriu" : e.entregue ? "entregue" : dataCurta(e.em)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ padding: "8px", minWidth: 170 }}>
                  {d.proximo ? (
                    <>
                      <div>{nomePasso(d.proximo.chave)}</div>
                      <div className="vx-mut">{d.proximo.status === "na_fila" ? "Na fila (sai na próxima rodada, das 9h às 20h)" : "Aguardando o intervalo de 20h"}</div>
                    </>
                  ) : <span className="vx-mut">{d.descadastrado ? "Não recebe mais" : "Nada a enviar agora"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrada.length === 0 && <div className="vx-mut" style={{ fontSize: 12.5, padding: 10 }}>Ninguém nesse filtro.</div>}
      {filtrada.length > limite && (
        <button type="button" className="vx-btn vx-btn-sm" style={{ marginTop: 10, minHeight: 44 }} onClick={() => setLimite((l) => l + 100)}>
          Mostrar mais ({filtrada.length - limite} restantes)
        </button>
      )}
    </div>
  );
}

const nomePasso = (k) => NOMES_PASSO[k]
  || (k.startsWith("empresas_offline:d") ? `Empresa parada · dia ${k.split(":d")[1]}` : "")
  || (k.startsWith("reativacao_empresas:d") ? `Reativação · dia ${k.split(":d")[1]}` : k);

const SEGMENTO = { nunca_ativou: "Nunca ativou", parou_de_usar: "Parou de usar" };
const MOTIVO = {
  reativada: "reativou", whatsapp_parar: "parou no WhatsApp", sem_canal: "sem canal", empresa_removida: "empresa removida",
  sem_case: "sem case", sem_oferta: "sem oferta", sem_link_agenda: "sem link de agenda", sem_vendedores_ativos: "sem vendedores",
  email_descadastrado: "descadastrou", email_bounce_ou_spam: "bounce ou spam", email_invalido: "e-mail inválido",
  sem_aceite: "sem aceite", pediu_para_sair: "pediu para sair", numero_invalido: "número inválido",
  modelo_nao_aprovado: "modelo não aprovado", whatsapp_nao_configurado: "WhatsApp não configurado",
};
const motivo = (m) => MOTIVO[m] || m;
const TIPO_ACAO = { inscrever: "Entra hoje", passo: "Próximo dia", whatsapp: "WhatsApp à tarde", sair: "Sai", concluir: "Conclui" };

// Reativação de empresas: estado, métricas, simulação do dia e teste interno.
function ReativacaoEmpresas({ aviso }) {
  const id = useId();
  const [p, setP] = useState(null);
  const [sim, setSim] = useState(null);
  const [email, setEmail] = useState("");
  const [numero, setNumero] = useState("");
  const [testando, setTestando] = useState(false);
  useEffect(() => { api("/admin/reativacao").then((r) => { if (r && !r.error) setP(r); }); }, []);
  const simular = () => api("/admin/reativacao/simulacao").then((r) => { if (r && !r.error) setSim(r); else aviso(r?.error || "Falha na simulação."); });
  const testar = async () => {
    setTestando(true);
    const r = await api("/admin/reativacao/teste", { email, numero });
    setTestando(false);
    if (!r || r.error) return aviso(r?.error || "Falha no teste.");
    const ok = r.emails.filter((e) => e.ok).length + r.whatsapp.filter((w) => w.ok).length;
    const pulados = [...r.emails, ...r.whatsapp].filter((x) => x.pulado).map((x) => `dia ${x.dia}: ${motivo(x.pulado)}`);
    const erros = [...r.emails, ...r.whatsapp].filter((x) => x.erro).map((x) => x.erro);
    aviso(`${ok} enviado(s).${pulados.length ? ` Pulados: ${pulados.join("; ")}.` : ""}${erros.length ? ` Erros: ${erros.join("; ")}` : ""}`);
  };
  if (!p) return null;
  const { config: c, metricas: m, pendencias } = p;
  const estado = !c.ligado ? "Desligada" : c.simulacao ? "Ligada em simulação (nada é enviado)" : "Ligada e enviando";
  const porSegmento = {};
  for (const l of m.inscricoes) {
    const s = (porSegmento[l.segmento] = porSegmento[l.segmento] || { total: 0, ativa: 0, reativada: 0 });
    s.total += l.n;
    if (l.status === "ativa") s.ativa += l.n;
    if (l.motivoSaida === "reativada") s.reativada += l.n;
  }
  const falta = [pendencias.caseDia4 && "case do dia 4", pendencias.ofertaDia6 && "oferta do dia 6", pendencias.linkAgendaDia5 && "link da agenda (dia 5)",
    !c.temRemetente && "remetente", !c.temAviso && "aviso de \"Quero agendar\"", !c.whatsappConfigurado && "WhatsApp"].filter(Boolean);
  const cel = { padding: "6px 8px", borderBottom: "1px solid var(--border)", textAlign: "left", fontSize: 12.5 };
  const dias = [1, 2, 3, 4, 5, 6, 7];
  const linhaEmail = (d) => m.email.find((x) => x.dia === d) || {};
  const linhaWa = (d) => m.whatsapp.find((x) => x.dia === d) || {};
  return (
    <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="vx-eyebrow">Empresas</div>
      <div className="vx-disp" style={{ fontSize: 17, marginTop: 2 }}>Reativação de empresas offline</div>
      <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
        {estado}. 7 dias úteis: e-mail a partir das 9h e WhatsApp nos dias 1, 3, 5 e 7 a partir das 14h. Inativa há {c.diasInativo}+ dias; até {c.maxEmailsDia} e-mails por dia.
        {falta.length > 0 && <> Faltando: {falta.join(", ")} (os passos que dependem disso ficam pulados).</>}
      </div>

      <div className="vx-grid vx-g2" style={{ marginTop: 14, gap: 10 }}>
        {Object.entries(SEGMENTO).map(([k, nome]) => (
          <div key={k} className="vx-card" style={{ padding: 12 }}>
            <div className="vx-label">{nome}</div>
            <div className="vx-mono" style={{ fontSize: 13, marginTop: 4 }}>
              {porSegmento[k]?.total || 0} inscrita(s) · {porSegmento[k]?.ativa || 0} na sequência · {porSegmento[k]?.reativada || 0} reativada(s)
            </div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead><tr>{["Dia", "E-mails", "Abertura", "Clique", "Bounce/spam", "WhatsApp", "Entregues", "Lidos", "Reativou"].map((h) => <th key={h} scope="col" style={{ ...cel, fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>
            {dias.map((d) => {
              const e = linhaEmail(d); const w = linhaWa(d);
              return (
                <tr key={d}>
                  <td style={cel}>{d}</td>
                  <td style={cel} className="vx-mono">{e.enviados || 0}{e.pulados ? ` (+${e.pulados} pulados)` : ""}</td>
                  <td style={cel} className="vx-mono">{e.taxaAbertura || 0}%</td>
                  <td style={cel} className="vx-mono">{e.taxaClique || 0}%</td>
                  <td style={cel} className="vx-mono">{(e.devolvidos || 0) + (e.spam || 0)}</td>
                  <td style={cel} className="vx-mono">{[1, 3, 5, 7].includes(d) ? `${w.enviados || 0}${w.pulados ? ` (+${w.pulados} pulados)` : ""}` : "—"}</td>
                  <td style={cel} className="vx-mono">{[1, 3, 5, 7].includes(d) ? w.entregues || 0 : "—"}</td>
                  <td style={cel} className="vx-mono">{[1, 3, 5, 7].includes(d) ? w.lidos || 0 : "—"}</td>
                  <td style={cel} className="vx-mono">{m.reativadas.porDia[d] || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 8 }}>
        Total: {m.totais.enviados} e-mail(s), abertura {m.totais.taxaAbertura}%, clique {m.totais.taxaClique}%. Reativadas: {m.totais.reativadas}
        {" "}(e-mail {m.reativadas.porCanal.email}, WhatsApp {m.reativadas.porCanal.whatsapp}, sem contato {m.reativadas.porCanal.sem_contato}).
        {m.respostas.length > 0 && <> Respostas no WhatsApp: {m.respostas.map((r) => `${r.acao.replace("_", " ")} ${r.n}`).join(", ")}.</>}
      </div>

      <div className="vx-row" style={{ marginTop: 16, gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={simular}>Simular hoje</button>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="vx-label" id={`${id}-e`}>E-mail de teste</span>
          <input className="vx-input" type="email" aria-labelledby={`${id}-e`} value={email} onChange={(e) => setEmail(e.target.value)} style={{ minHeight: 44 }} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="vx-label" id={`${id}-n`}>WhatsApp de teste (DDI + DDD)</span>
          <input className="vx-input" type="tel" inputMode="numeric" aria-labelledby={`${id}-n`} value={numero} onChange={(e) => setNumero(e.target.value)} style={{ minHeight: 44 }} />
        </label>
        <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={testar} disabled={testando || (!email && !numero)}>{testando ? "Enviando…" : "Enviar teste"}</button>
      </div>

      {sim && (
        <div style={{ marginTop: 14 }}>
          <div className="vx-mut" style={{ fontSize: 12.5 }}>
            {sim.diaUtil ? `Hoje (${sim.dia})` : `${sim.dia} não é dia útil`}: {sim.totais.inscrever} entram, {sim.totais.passos} seguem, {sim.totais.whatsapp} WhatsApp, {sim.totais.saidas} saem
            {sim.totais.adiadasPeloTeto ? `, ${sim.totais.adiadasPeloTeto} ficam para amanhã pelo teto` : ""}.
          </div>
          {sim.linhas.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead><tr>{["Empresa", "O que acontece", "Dia", "E-mail", "WhatsApp"].map((h) => <th key={h} scope="col" style={{ ...cel, fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {sim.linhas.slice(0, 100).map((l, i) => (
                    <tr key={`${l.companyId}-${i}`}>
                      <td style={cel}>{l.empresa}<div className="vx-mut" style={{ fontSize: 11.5 }}>{SEGMENTO[l.segmento] || ""}</div></td>
                      <td style={cel}>{TIPO_ACAO[l.tipo] || l.tipo}{l.motivo ? ` (${motivo(l.motivo)})` : ""}</td>
                      <td style={cel} className="vx-mono">{l.dia || "—"}</td>
                      <td style={cel}>{!l.mensagemEmail ? "—" : l.mensagemEmail.pular ? `pula: ${motivo(l.mensagemEmail.pular)}` : `${l.mensagemEmail.assunto}${l.mensagemEmail.acimaDoTeto ? " (amanhã, teto)" : ""}`}</td>
                      <td style={cel}>{!l.whatsapp ? "—" : l.whatsapp.pular ? `pula: ${motivo(l.whatsapp.pular)}` : `${l.whatsapp.modelo} às ${l.whatsapp.horario}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sequências automáticas do funil: números, prévia de cada e-mail e teste
// enviado para o e-mail do próprio admin.
export default function SequenciasFunil({ aviso }) {
  const id = useId();
  const [dados, setDados] = useState(null);
  const [chaves, setChaves] = useState([]);
  const [chave, setChave] = useState("onboarding:boas_vindas");
  const [idioma, setIdioma] = useState("pt");
  const [previa, setPrevia] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [completa, setCompleta] = useState(false);
  const [destinatarios, setDestinatarios] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const carregarMetricas = () => api("/admin/sequencias-email/metricas").then((r) => { if (r && !r.error) setMetricas(r); });
  const sincronizar = async () => {
    setSincronizando(true);
    const r = await api("/admin/sequencias-email/sincronizar", {});
    setSincronizando(false);
    if (!r || r.erro || r.error) return aviso(r?.erro || r?.error || "Não foi possível consultar o Resend.");
    aviso(`${r.verificados} e-mail(s) consultado(s), ${r.atualizados} atualizado(s)${r.falhas ? `, ${r.falhas} sem resposta` : ""}.`);
    carregarMetricas();
    carregarDestinatarios();
  };
  const carregarDestinatarios = () => api("/admin/sequencias-email/destinatarios").then((r) => { if (Array.isArray(r?.destinatarios)) setDestinatarios(r.destinatarios); });

  const carregar = () => api("/admin/sequencias-email").then((r) => { if (r && !r.error) setDados(r); });
  useEffect(() => {
    carregar();
    carregarDestinatarios();
    carregarMetricas();
    api("/admin/sequencias-email/modelos").then((r) => { if (r?.chaves) setChaves(r.chaves); });
  }, []);
  useEffect(() => {
    api("/admin/sequencias-email/previa", { chave, idioma }).then((r) => setPrevia(r && !r.error ? r : null));
  }, [chave, idioma]);

  const testar = async () => {
    setOcupado(true);
    const r = await api("/admin/sequencias-email/teste", { chave, idioma });
    setOcupado(false);
    aviso(r?.ok ? `Teste enviado para ${r.para}.` : r?.error || "Falha no envio.");
  };
  const rodarAgora = async () => {
    setOcupado(true);
    const r = await api("/admin/sequencias-email/rodar", {});
    setOcupado(false);
    if (r?.error) return aviso(r.error);
    if (r?.ocupado) return aviso("Já existe um disparo em andamento. Aguarde e atualize.");
    const n = r?.enviados || 0;
    aviso(`${n} e-mail(s) enviado(s)${r?.falhas ? `, ${r.falhas} falha(s)` : ""}.${n === 0 ? " Ninguém na fila agora." : ""}`);
    carregar();
    carregarDestinatarios();
    carregarMetricas();
  };

  if (!dados) return <div className="vx-card" style={{ padding: 20, marginBottom: 20 }}>Carregando sequências automáticas…</div>;

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div className="vx-eyebrow">Funil automático</div>
            <div className="vx-disp" style={{ fontSize: 17, marginTop: 2 }}>
              {dados.ligado ? "Ligado" : "Desligado"} · {dados.enviadosHoje} de {dados.tetoHoje} enviados hoje
            </div>
            <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
              Na fila agora: {dados.naFila} · Descadastrados: {dados.descadastros} · Contas inativas por perfil incompleto: {dados.inativos}<br />
              Envia das 9h às 20h (Brasília), no máximo 1 por pessoa por dia. O teto diário sobe 50 por dia para aquecer o domínio.
            </div>
          </div>
          <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={rodarAgora} disabled={ocupado || !dados.ligado}>{ocupado ? "Enviando…" : "Rodar agora"}</button>
        </div>

        <div className="vx-grid vx-g2" style={{ marginTop: 14, gap: 10 }}>
          {dados.sequencias.map((s) => (
            <div key={s.chave} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <b style={{ fontSize: 13.5 }}>{s.nome}</b>
              {s.passos.length === 0
                ? <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>Nenhum envio ainda.</div>
                : s.passos.map((p) => (
                  <div key={p.passo} className="vx-row" style={{ fontSize: 12, marginTop: 4 }}>
                    <span>{nomePasso(p.passo)}</span>
                    <span className="vx-mono">{p.enviados}{p.falhas ? ` · ${p.falhas} falha(s)` : ""}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      <Metricas m={metricas} ordem={[...Object.keys(NOMES_PASSO), ...chaves.filter((k) => !NOMES_PASSO[k])]} onSincronizar={sincronizar} sincronizando={sincronizando} />

      <ReativacaoEmpresas aviso={aviso} />

      <Destinatarios lista={destinatarios} />

      <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="vx-row" style={{ marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
          <div className="vx-disp" style={{ fontSize: 15 }}>Prévia dos e-mails</div>
          <div role="radiogroup" aria-label="Modo da prévia" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: "var(--surface-2, #F1F5F9)", border: "1px solid var(--border)" }}>
            {[[false, "Um por vez"], [true, "Sequência completa"]].map(([v, l]) => (
              <button key={l} type="button" role="radio" aria-checked={completa === v} onClick={() => setCompleta(v)}
                style={{ minHeight: 36, padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
                  color: completa === v ? "#fff" : "var(--muted)", background: completa === v ? "var(--brand)" : "transparent" }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          {!completa && <label style={{ flex: "1 1 260px" }}>
            <span className="vx-label" id={`${id}-k`}>E-mail</span>
            <select className="vx-input" aria-labelledby={`${id}-k`} value={chave} onChange={(e) => setChave(e.target.value)} style={{ minHeight: 44 }}>
              {chaves.map((k) => <option key={k} value={k}>{nomePasso(k)}</option>)}
            </select>
          </label>}
          <label style={{ flex: "0 1 160px" }}>
            <span className="vx-label" id={`${id}-i`}>Idioma</span>
            <select className="vx-input" aria-labelledby={`${id}-i`} value={idioma} onChange={(e) => setIdioma(e.target.value)} style={{ minHeight: 44 }}>
              <option value="pt">Português</option>
              <option value="en">Inglês</option>
            </select>
          </label>
          {!completa && <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={testar} disabled={ocupado}>Enviar teste para mim</button>}
        </div>
        {completa && <SequenciaCompleta chaves={chaves} idioma={idioma} contagem={destinatarios ? contagemPorPasso(destinatarios) : null} />}
        {!completa && previa && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13 }}><span className="vx-mut">Assunto:</span> <b>{previa.assunto}</b></div>
            <iframe title="Prévia do e-mail" srcDoc={previa.html} sandbox=""
              style={{ width: "100%", height: 640, border: "1px solid var(--border)", borderRadius: 10, marginTop: 8, background: "#fff" }} />
          </div>
        )}
      </div>

      {dados.ultimos.length > 0 && (
        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-disp" style={{ fontSize: 15, marginBottom: 8 }}>Últimos envios</div>
          {dados.ultimos.map((u, i) => (
            <div key={i} className="vx-row" style={{ fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid var(--border)", gap: 10 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email} · {u.assunto}</span>
              <span style={{ color: u.status === "enviado" ? "var(--green)" : "var(--red)", whiteSpace: "nowrap" }} title={u.erro || ""}>
                {u.status === "enviado" ? "Enviado" : "Falhou"} · {dataCurta(u.enviadoEm)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
