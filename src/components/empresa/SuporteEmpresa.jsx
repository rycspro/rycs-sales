import { useMemo, useRef, useState } from "react";
import {
  Plus, Search, BookOpen, Headset, Megaphone, Users, Wallet, GraduationCap,
  FolderOpen, Settings2, MessageCircle, Mail, X, Inbox, ChevronRight, Paperclip,
} from "lucide-react";

// Central de Ajuda da empresa (ETAPA 01 — revitalização visual).
// Comunicação dirigida ao dono/administrador da empresa.
//
// Sem dados fictícios: a base de conhecimento e o sistema de chamados ainda não
// têm backend. As categorias abrem estado vazio ("conteúdos em breve"), "Meus
// chamados" mostra estado vazio, e "Novo chamado" encaminha a solicitação pelo
// e-mail oficial (ação real) até o sistema de chamados existir (ETAPA 03).

const AZUL = "#318CE7";
const AZUL_SUAVE = "#EAF4FF";

// Número oficial de WhatsApp do suporte. Vazio = ainda não configurado — não
// inventamos um número de exemplo. Preencher quando a RYCS definir o canal.
const WHATSAPP_SUPORTE = "";
const EMAIL_SUPORTE = "suporte@rycs.pro";

const CATEGORIAS = [
  { chave: "campanhas", icon: Megaphone, titulo: "Campanhas", desc: "Criação, configuração, publicação e gestão de campanhas.", busca: "campanha publicar criar publicação orçamento tarefas" },
  { chave: "profissionais", icon: Users, titulo: "Profissionais", desc: "Candidaturas, aprovações, vínculos e acompanhamento.", busca: "profissional aprovar candidatura vínculo aprovação equipe" },
  { chave: "pagamentos", icon: Wallet, titulo: "Pagamentos", desc: "Saldos, comissões, aprovações e pagamentos.", busca: "pagamento saldo comissão adicionar saldo liberação cobrança plano" },
  { chave: "academy", icon: GraduationCap, titulo: "Academy", desc: "Treinamentos, módulos, conteúdos e aprendizado.", busca: "academy módulo treinamento aprendizado curso" },
  { chave: "materiais", icon: FolderOpen, titulo: "Materiais", desc: "Informações empresariais, arquivos e biblioteca de conteúdos.", busca: "materiais arquivo biblioteca conteúdo ia informações empresa" },
  { chave: "outros", icon: Settings2, titulo: "Outros", desc: "Dados da empresa, preferências, acessos e permissões.", busca: "configuração dados empresa preferência acesso permissão conta outros" },
];

const CATEGORIAS_CHAMADO = [...CATEGORIAS.map((c) => ({ chave: c.chave, titulo: c.titulo })), { chave: "outros", titulo: "Outros" }];

function Secao({ titulo, desc, children, innerRef }) {
  return (
    <section ref={innerRef} style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#171717", margin: "0 0 3px", letterSpacing: "-.01em" }}>{titulo}</h2>
      {desc && <p style={{ fontSize: 13, color: "#737373", margin: "0 0 14px", lineHeight: 1.5 }}>{desc}</p>}
      {children}
    </section>
  );
}

// ── Painel lateral: Novo chamado ────────────────────────────────────────────
function DrawerChamado({ emp, aviso, categoriaInicial, onFechar }) {
  const [assunto, setAssunto] = useState("");
  const [categoria, setCategoria] = useState(categoriaInicial || "");
  const [descricao, setDescricao] = useState("");

  const enviar = () => {
    // Sem backend de chamados ainda: encaminha pelo e-mail oficial (ação real).
    const corpo =
      `Empresa: ${emp?.nome || "—"}\n` +
      `Categoria: ${CATEGORIAS_CHAMADO.find((c) => c.chave === categoria)?.titulo || "—"}\n\n` +
      `${descricao}`;
    const url = `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(`[Chamado] ${assunto}`)}&body=${encodeURIComponent(corpo)}`;
    window.location.href = url;
    aviso?.("Abrimos seu e-mail para enviar a solicitação à equipe RYCS.");
    onFechar();
  };

  const podeEnviar = assunto.trim() && categoria && descricao.trim();

  return (
    <div onClick={onFechar} className="vx-fade" style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,17,33,.38)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Novo chamado" style={{ width: "min(460px, 100%)", height: "100%", background: "#fff", borderLeft: "1px solid #E8EAED", boxShadow: "-16px 0 44px rgba(17,24,39,.14)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #E8EAED" }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#737373" }}>Suporte</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#171717", marginTop: 2 }}>Novo chamado</div>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 7 }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <label>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#171717", marginBottom: 6 }}>Assunto</div>
            <input className="vx-input" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Título curto da solicitação" />
          </label>
          <label>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#171717", marginBottom: 6 }}>Categoria</div>
            <select className="vx-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Selecione a categoria</option>
              {CATEGORIAS_CHAMADO.map((c) => <option key={c.chave} value={c.chave}>{c.titulo}</option>)}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#171717", marginBottom: 6 }}>Descrição</div>
            <textarea className="vx-input" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={6} placeholder="Descreva o que aconteceu ou como podemos ajudar." style={{ resize: "vertical", minHeight: 120 }} />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#737373", background: "#F8F9FB", border: "1px solid #E8EAED", borderRadius: 10, padding: "10px 12px" }}>
            <Paperclip size={14} style={{ flexShrink: 0 }} />
            <span>Anexos (prints e documentos) estarão disponíveis quando o acompanhamento de chamados for ativado.</span>
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid #E8EAED" }}>
          <button type="button" className="vx-btn vx-btn-block" disabled={!podeEnviar} onClick={enviar} style={{ background: AZUL, borderColor: AZUL, color: "#fff" }}>
            Enviar solicitação
          </button>
          <p style={{ fontSize: 11.5, color: "#737373", margin: "8px 0 0", textAlign: "center" }}>
            A solicitação é enviada por e-mail à equipe RYCS. O acompanhamento dentro da plataforma chega em breve.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SuporteEmpresa({ emp, aviso }) {
  const [busca, setBusca] = useState("");
  const [drawer, setDrawer] = useState(null); // { categoria } | null
  const [categoriaAberta, setCategoriaAberta] = useState(null);
  const refAjuda = useRef(null);
  const refAtendimento = useRef(null);

  const termo = busca.trim().toLowerCase();
  const categoriasFiltradas = useMemo(() => {
    if (!termo) return CATEGORIAS;
    return CATEGORIAS.filter((c) => `${c.titulo} ${c.desc} ${c.busca}`.toLowerCase().includes(termo));
  }, [termo]);

  const irPara = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="vx-fade" style={{ maxWidth: 1040 }}>
      {/* ── Cabeçalho ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#737373" }}>Central de ajuda</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "#171717", margin: "3px 0 4px", letterSpacing: "-.02em" }}>Como podemos ajudar?</h1>
          <p style={{ fontSize: 13.5, color: "#737373", margin: 0, lineHeight: 1.5 }}>Encontre respostas, acompanhe solicitações ou fale com nossa equipe.</p>
        </div>
        <button type="button" onClick={() => setDrawer({ categoria: "" })} className="vx-btn" style={{ background: AZUL, borderColor: AZUL, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <Plus size={16} /> Novo chamado
        </button>
      </div>

      {/* ── Busca ── */}
      <div style={{ position: "relative", marginTop: 18 }}>
        <Search size={18} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "#98A2B3", pointerEvents: "none" }} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Busque uma dúvida, funcionalidade ou orientação..."
          aria-label="Buscar na central de ajuda"
          style={{ width: "100%", background: "#F8F9FB", border: `1px solid #E8EAED`, borderRadius: 12, padding: "14px 16px 14px 44px", fontSize: 14, color: "#171717", outline: "none" }}
          onFocus={(e) => { e.target.style.borderColor = AZUL; e.target.style.background = "#fff"; }}
          onBlur={(e) => { e.target.style.borderColor = "#E8EAED"; e.target.style.background = "#F8F9FB"; }}
        />
      </div>

      {/* ── Acessos rápidos (ocultos durante a busca) ── */}
      {!termo && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 14, marginTop: 16 }}>
          {[
            { icon: BookOpen, titulo: "Central de ajuda", desc: "Encontre tutoriais e orientações para utilizar os recursos da RYCS.", acao: "Explorar conteúdos", onClick: () => irPara(refAjuda) },
            { icon: Headset, titulo: "Falar com suporte", desc: "Precisa de atendimento? Entre em contato com nossa equipe.", acao: "Ver atendimento", onClick: () => irPara(refAtendimento) },
          ].map(({ icon: Icon, titulo, desc, acao, onClick }) => (
            <button key={titulo} type="button" onClick={onClick} className="vx-sup-card" style={{ textAlign: "left", background: "#fff", border: "1px solid #E8EAED", borderRadius: 12, padding: 18, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={19} style={{ color: AZUL }} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "#171717" }}>{titulo}</div>
                <div style={{ fontSize: 12.5, color: "#737373", marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: AZUL, marginTop: 2 }}>{acao} <ChevronRight size={14} /></span>
            </button>
          ))}
        </div>
      )}

      {/* ── Ajuda por assunto ── */}
      <Secao innerRef={refAjuda} titulo="Ajuda por assunto" desc="Encontre orientações sobre as principais áreas da plataforma.">
        {categoriasFiltradas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 20px", background: "#F8F9FB", border: "1px solid #E8EAED", borderRadius: 12 }}>
            <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#737373" }}>Não encontramos conteúdos para sua busca.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="vx-btn vx-btn-sm" onClick={() => setBusca("")}>Limpar busca</button>
              <button type="button" className="vx-btn vx-btn-sm" onClick={() => setDrawer({ categoria: "" })} style={{ background: AZUL, borderColor: AZUL, color: "#fff" }}>Abrir chamado</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
            {categoriasFiltradas.map((c) => (
              <button key={c.chave} type="button" onClick={() => setCategoriaAberta(c)} className="vx-sup-card" style={{ textAlign: "left", background: "#fff", border: "1px solid #E8EAED", borderRadius: 12, padding: 16, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <c.icon size={18} style={{ color: AZUL }} strokeWidth={2} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>{c.titulo}</div>
                  <div style={{ fontSize: 12.5, color: "#737373", marginTop: 2, lineHeight: 1.45 }}>{c.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Secao>

      {/* ── Meus chamados (estado vazio — sem backend ainda) ── */}
      <Secao titulo="Meus chamados" desc="Acompanhe suas solicitações e respostas da equipe RYCS.">
        <div style={{ textAlign: "center", padding: "36px 20px", background: "#fff", border: "1px solid #E8EAED", borderRadius: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Inbox size={22} style={{ color: "#98A2B3" }} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "#171717", marginBottom: 4 }}>Nenhum chamado registrado</div>
          <p style={{ fontSize: 13, color: "#737373", margin: "0 auto 14px", maxWidth: 360, lineHeight: 1.5 }}>Suas solicitações de atendimento aparecerão aqui.</p>
          <button type="button" onClick={() => setDrawer({ categoria: "" })} className="vx-btn vx-btn-sm" style={{ background: AZUL, borderColor: AZUL, color: "#fff" }}>Abrir chamado</button>
        </div>
      </Secao>

      {/* ── Atendimento direto ── */}
      <Secao innerRef={refAtendimento} titulo="Atendimento direto" desc="Prefere falar com nossa equipe por outro canal?">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12 }}>
          {/* WhatsApp */}
          <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageCircle size={18} style={{ color: AZUL }} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>WhatsApp</div>
                <div style={{ fontSize: 12, color: "#737373" }}>Atendimento em horário comercial.</div>
              </div>
            </div>
            {WHATSAPP_SUPORTE ? (
              <a href={`https://wa.me/${WHATSAPP_SUPORTE.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="vx-btn vx-btn-sm" style={{ justifyContent: "center", background: AZUL, borderColor: AZUL, color: "#fff" }}>Conversar no WhatsApp</a>
            ) : (
              <button type="button" className="vx-btn vx-btn-sm" disabled style={{ justifyContent: "center" }}>Número a configurar</button>
            )}
          </div>
          {/* E-mail */}
          <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Mail size={18} style={{ color: AZUL }} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>E-mail</div>
                <div style={{ fontSize: 12, color: "#737373" }}>{EMAIL_SUPORTE}</div>
              </div>
            </div>
            <a href={`mailto:${EMAIL_SUPORTE}`} className="vx-btn vx-btn-sm" style={{ justifyContent: "center", background: AZUL, borderColor: AZUL, color: "#fff" }}>Enviar e-mail</a>
          </div>
        </div>
      </Secao>

      {/* ── Estado vazio da categoria (conteúdos em breve) ── */}
      {categoriaAberta && (
        <div onClick={() => setCategoriaAberta(null)} className="vx-fade" style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,17,33,.38)", display: "flex", justifyContent: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={categoriaAberta.titulo} style={{ width: "min(460px, 100%)", height: "100%", background: "#fff", borderLeft: "1px solid #E8EAED", boxShadow: "-16px 0 44px rgba(17,24,39,.14)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #E8EAED" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <categoriaAberta.icon size={19} style={{ color: AZUL }} strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#171717" }}>{categoriaAberta.titulo}</div>
                <div style={{ fontSize: 12, color: "#737373" }}>{categoriaAberta.desc}</div>
              </div>
              <button type="button" onClick={() => setCategoriaAberta(null)} aria-label="Fechar" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 7 }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "40px 22px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <BookOpen size={22} style={{ color: "#98A2B3" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#171717", marginBottom: 6 }}>Conteúdos em breve</div>
              <p style={{ fontSize: 13, color: "#737373", margin: "0 auto 16px", maxWidth: 320, lineHeight: 1.6 }}>
                Estamos preparando os tutoriais e orientações de <b>{categoriaAberta.titulo}</b>. Enquanto isso, fale com a equipe se precisar de ajuda.
              </p>
              <button type="button" onClick={() => { setDrawer({ categoria: categoriaAberta.chave }); setCategoriaAberta(null); }} className="vx-btn vx-btn-sm" style={{ background: AZUL, borderColor: AZUL, color: "#fff" }}>Abrir chamado sobre {categoriaAberta.titulo}</button>
            </div>
          </div>
        </div>
      )}

      {drawer && <DrawerChamado emp={emp} aviso={aviso} categoriaInicial={drawer.categoria} onFechar={() => setDrawer(null)} />}
    </div>
  );
}
