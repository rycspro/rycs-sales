import { useState } from "react";
import {
  ArrowLeft, ChevronRight, CircleUserRound, GraduationCap, Gift, Headphones,
  LogOut, Mail, RotateCcw, Settings, ShieldCheck, Target, Wallet,
} from "lucide-react";
import ThemeSwitcher from "../ThemeSwitcher.jsx";

// Minha Conta do profissional. É o hub aberto pelo menu de conta da barra
// lateral: concentra atalhos para as telas reais (Perfil, Carteira, Academy,
// Indicar), as preferências e a ajuda. Não guarda dado próprio nem inventa
// endpoint — só navega e aciona ações que já existem (sair, refazer avaliação,
// trocar tema). Usa o sistema de classes .vx-account-* já definido em styles.js.

const PERFIS = { sdr: "SDR", closer: "Closer", bdr: "BDR", pap: "PAP", "sem-exp": "Iniciante" };

const STATUS = {
  aprovado: { texto: "Aprovado", tom: "vx-badge-brand" },
  parcial: { texto: "Aprovação parcial", tom: "vx-badge-amber" },
  triagem: { texto: "Em avaliação", tom: "vx-badge-amber" },
  recusado: { texto: "Avaliação pendente", tom: "vx-badge-red" },
};

function localizacao(eu) {
  const c = String(eu?.cidade || "").trim();
  const e = String(eu?.estado || "").trim();
  if (!e) return c;
  if (!c) return e;
  return new RegExp(`\\b${e}\\b`, "i").test(c) ? c : `${c} · ${e}`;
}

function Item({ Icon, titulo, descricao, onClick, tom }) {
  return (
    <button type="button" className="vx-account-item" onClick={onClick} style={tom ? { color: tom } : undefined}>
      <Icon size={20} strokeWidth={1.85} />
      <span>
        <strong>{titulo}</strong>
        {descricao && <small>{descricao}</small>}
      </span>
      <ChevronRight size={18} style={{ color: "var(--muted-2)", flexShrink: 0 }} />
    </button>
  );
}

export default function MinhaConta({
  secaoInicial = "", entity: eu, user, onNavigate, onLogout, refazerAvaliacao,
}) {
  const [secao, setSecao] = useState(secaoInicial || "conta");

  const nome = [eu?.nome, eu?.sobrenome].filter(Boolean).join(" ") || user?.email || "Profissional";
  const email = eu?.email || user?.email || "";
  const perfil = PERFIS[eu?.perfil] || eu?.titulo || "";
  const local = localizacao(eu);
  const status = STATUS[eu?.status];
  const podeRefazer = (eu?.status === "recusado" || eu?.status === "parcial") && typeof refazerAvaliacao === "function";

  const titulo = secao === "preferencias" ? "Configurações" : secao === "suporte" ? "Ajuda e suporte" : "Minha conta";
  const apoio = secao === "preferencias"
    ? "Ajuste o tema e revise seu acesso."
    : secao === "suporte"
      ? "Fale com a equipe da RYCS."
      : "Seu perfil, carteira e preferências em um só lugar.";

  const voltar = secao !== "conta" ? () => setSecao("conta") : null;

  return (
    <div className="vx-account vx-fade">
      <div className="vx-account-heading">
        {voltar && (
          <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" onClick={voltar} style={{ marginBottom: 12, paddingLeft: 0 }}>
            <ArrowLeft size={16} /> Minha conta
          </button>
        )}
        <h1>{titulo}</h1>
        <p>{apoio}</p>
      </div>

      <div className="vx-account-identity">
        {eu?.foto
          ? <img className="vx-account-avatar" src={eu.foto} alt="" />
          : <span className="vx-account-avatar">{nome.slice(0, 1).toUpperCase()}</span>}
        <div>
          <strong>{nome}</strong>
          {email && <span>{email}</span>}
          <small>
            {[perfil, local].filter(Boolean).join(" · ")}
            {status && <> · <span className={"vx-badge " + status.tom} style={{ marginLeft: 4 }}>{status.texto}</span></>}
          </small>
        </div>
      </div>

      {secao === "conta" && (
        <div className="vx-account-grid">
          <div className="vx-account-group">
            <h2>Atalhos</h2>
            <Item Icon={CircleUserRound} titulo="Meu perfil" descricao="Foto, dados e especialidades" onClick={() => onNavigate?.("perfil")} />
            <Item Icon={Wallet} titulo="Carteira" descricao="Saldo, saques e extrato de ações" onClick={() => onNavigate?.("carteira")} />
            <Item Icon={GraduationCap} titulo="Academy" descricao="Cursos e certificações" onClick={() => onNavigate?.("academy")} />
            <Item Icon={Gift} titulo="Indicar" descricao="Convide outros profissionais" onClick={() => onNavigate?.("indicar")} />
          </div>

          <div className="vx-account-group">
            <h2>Conta</h2>
            <Item Icon={Settings} titulo="Configurações" descricao="Tema e preferências" onClick={() => setSecao("preferencias")} />
            <Item Icon={Headphones} titulo="Ajuda e suporte" descricao="Fale com a RYCS" onClick={() => setSecao("suporte")} />
            {podeRefazer && (
              <Item Icon={RotateCcw} titulo="Refazer avaliação" descricao="Tente a triagem novamente" onClick={() => refazerAvaliacao()} />
            )}
          </div>
        </div>
      )}

      {secao === "preferencias" && (
        <div className="vx-account-grid">
          <div className="vx-account-group">
            <h2>Aparência</h2>
            <div className="vx-account-item" style={{ cursor: "default" }}>
              <Settings size={20} strokeWidth={1.85} />
              <span><strong>Tema</strong><small>Claro ou escuro</small></span>
              <ThemeSwitcher />
            </div>
          </div>
          <div className="vx-account-group">
            <h2>Acesso</h2>
            <div className="vx-account-item" style={{ cursor: "default" }}>
              <ShieldCheck size={20} strokeWidth={1.85} />
              <span><strong>E-mail de acesso</strong><small>{email || "—"}</small></span>
            </div>
            {podeRefazer && (
              <Item Icon={RotateCcw} titulo="Refazer avaliação" descricao="Tente a triagem novamente" onClick={() => refazerAvaliacao()} />
            )}
          </div>
        </div>
      )}

      {secao === "suporte" && (
        <div className="vx-account-grid">
          <div className="vx-account-group">
            <h2>Fale com a gente</h2>
            <a className="vx-account-item" href="mailto:contato@rycs.com.br" style={{ textDecoration: "none" }}>
              <Mail size={20} strokeWidth={1.85} />
              <span><strong>E-mail</strong><small>contato@rycs.com.br</small></span>
              <ChevronRight size={18} style={{ color: "var(--muted-2)", flexShrink: 0 }} />
            </a>
            <div className="vx-account-item" style={{ cursor: "default" }}>
              <Target size={20} strokeWidth={1.85} />
              <span><strong>Dúvidas sobre campanhas</strong><small>Veja a Academy ou fale com a empresa pela conversa da campanha.</small></span>
            </div>
          </div>
        </div>
      )}

      {onLogout && (
        <button type="button" className="vx-account-item vx-account-logout" onClick={onLogout} style={{ marginTop: 24 }}>
          <LogOut size={20} strokeWidth={1.85} />
          <span><strong>Sair da conta</strong></span>
        </button>
      )}
    </div>
  );
}
