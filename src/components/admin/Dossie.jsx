import { useState, useEffect } from "react";
import { Sparkles, AlertTriangle, Target, Briefcase } from "lucide-react";
import { api } from "../../lib/api.js";
import { Medidor } from "../ui.jsx";

// Dossiê da plataforma — profissional e empresa.
//
// A leitura estruturada vem sempre, montada por regra no servidor. A
// narrativa por IA vem por cima, em bloco separado e rotulado. Quando não há
// provedor configurado ela vem nula, e a tela DIZ isso em vez de esconder: um
// painel que some sem explicação faz a pessoa achar que o dossiê está
// quebrado. O mesmo princípio da auditoria — indisponível não é o mesmo que
// negativo, e nenhum dos dois pode ser inventado.

// A leitura vem de duas fontes: provedor externo quando há chave, e o motor
// interno da RYCS sempre que não há. As duas aparecem sob o mesmo rótulo para
// quem usa, mas a origem vai no dado e é mostrada no rodapé do bloco — quem
// audita uma decisão precisa saber o que escreveu aquele parecer.
const ORIGEM = {
  externo: "Gerado por modelo de linguagem externo.",
  interno: "Gerado pelo motor de leitura da RYCS, a partir dos números deste dossiê.",
};

function Narrativa({ leitura }) {
  const texto = typeof leitura === "string" ? leitura : leitura?.texto;
  const fonte = typeof leitura === "string" ? "externo" : leitura?.fonte;

  if (!texto) {
    return (
      <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px dashed var(--border)", marginBottom: 14 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 4 }}>Leitura por IA</div>
        <div className="vx-mut" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Sem dados suficientes para montar a leitura deste cadastro.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "13px 15px", borderRadius: 10, background: "var(--brand-50)", border: "1px solid var(--brand-100)", marginBottom: 14 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 5, color: "var(--brand)", display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={12} /> Leitura por IA
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)" }}>{texto}</div>
      <div className="vx-mut" style={{ fontSize: 11, marginTop: 8, fontStyle: "italic" }}>
        {ORIGEM[fonte] || ORIGEM.interno} Texto auxiliar: nenhuma decisão da plataforma depende dele.
      </div>
    </div>
  );
}

function Alertas({ itens }) {
  if (!itens?.length) return null;
  return (
    <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "rgba(240,180,94,.08)", border: "1px solid rgba(240,180,94,.2)" }}>
      <div className="vx-eyebrow" style={{ color: "var(--amber)", marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
        <AlertTriangle size={12} /> Pede atenção
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, lineHeight: 1.75, color: "var(--text-2)" }}>
        {itens.map((a, i) => <li key={i}>{a}</li>)}
      </ul>
    </div>
  );
}

function useDossie(rota) {
  const [estado, setEstado] = useState({ carregando: true, dossie: null, erro: null });
  useEffect(() => {
    let vivo = true;
    setEstado({ carregando: true, dossie: null, erro: null });
    api(rota).then((r) => {
      if (!vivo) return;
      if (!r || r.error) setEstado({ carregando: false, dossie: null, erro: r?.error || "Não foi possível carregar o dossiê." });
      else setEstado({ carregando: false, dossie: r.dossie, erro: null });
    });
    return () => { vivo = false; };
  }, [rota]);
  return estado;
}

const Caixa = ({ children }) => (
  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>{children}</div>
);

// `valor || "—"` transformaria 0 em traço, e zero aqui é informação: "nenhuma
// ação recebida" é diferente de "não sabemos quantas ações".
const vazioMesmo = (v) => v === null || v === undefined || v === "" ||
  (Array.isArray(v) && v.length === 0);

const Campo = ({ rotulo, valor }) => (
  <div>
    <span className="vx-mut" style={{ fontSize: 11.5 }}>{rotulo}</span>
    <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.5 }}>
      {vazioMesmo(valor) ? "—" : valor}
    </div>
  </div>
);

// ---------------------------------------------------------------- profissional

export function DossieProfissional({ sellerId }) {
  const { carregando, dossie, erro } = useDossie(`/triagem/${sellerId}/dossie`);

  if (carregando) return <Caixa><div className="vx-mut" style={{ fontSize: 12.5 }}>Montando o dossiê…</div></Caixa>;
  if (erro) return <Caixa><div className="vx-mut" style={{ fontSize: 12.5 }}>{erro}</div></Caixa>;

  const { resumo, categorias, funcoes, declarado, alertas } = dossie;

  return (
    <Caixa>
      <div className="vx-eyebrow" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Target size={12} /> Especialidade
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{resumo.veredito}</div>

      <Narrativa leitura={dossie.narrativa} />

      {/* Prontidão por função: é aqui que a especialidade fica objetiva. */}
      <div style={{ display: "grid", gap: 8 }}>
        {funcoes.map((f) => (
          <div key={f.funcao} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 62, fontSize: 12.5, fontWeight: 600 }}>{f.nome}</div>
            <div style={{ flex: 1 }}>
              <Medidor value={f.cobertura} tone={f.cobertura >= 75 ? "brand" : f.cobertura >= 50 ? "amber" : "red"} />
            </div>
            <div className="vx-mut" style={{ fontSize: 11.5, width: 150, textAlign: "right" }}>{f.veredito}</div>
          </div>
        ))}
      </div>

      {resumo.entregaHoje?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Entrega hoje</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, lineHeight: 1.8, color: "var(--text-2)" }}>
            {resumo.entregaHoje.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {resumo.naoEntregaAinda?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Ainda não entrega</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, lineHeight: 1.8, color: "var(--muted)" }}>
            {resumo.naoEntregaAinda.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      <div className="vx-grid vx-g4" style={{ marginTop: 14 }}>
        <Campo rotulo="Ticket máximo" valor={declarado.ticketMaximo} />
        <Campo rotulo="Capacidade/dia" valor={declarado.capacidadeDiaria} />
        <Campo rotulo="Velocidade de contato" valor={declarado.velocidadeContato} />
        <Campo rotulo="Segmentos" valor={declarado.segmentos?.join(", ")} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Por categoria</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
          {categorias.map((c) => (
            <div key={c.chave} style={{ fontSize: 12 }}>
              <div className="vx-row" style={{ marginBottom: 3 }}>
                <span className="vx-mut">{c.nome}</span>
                <b className="vx-mono">{c.valor}</b>
              </div>
              <Medidor value={c.valor} tone={c.leitura === "forte" ? "brand" : c.leitura === "mediano" ? "amber" : "red"} />
            </div>
          ))}
        </div>
      </div>

      <Alertas itens={alertas} />
    </Caixa>
  );
}

// --------------------------------------------------------------------- empresa

export function DossieEmpresa({ companyId }) {
  const { carregando, dossie, erro } = useDossie(`/companies/${companyId}/dossie`);

  if (carregando) return <Caixa><div className="vx-mut" style={{ fontSize: 12.5 }}>Montando o dossiê…</div></Caixa>;
  if (erro) return <Caixa><div className="vx-mut" style={{ fontSize: 12.5 }}>{erro}</div></Caixa>;

  const { resumo, oferta, identidade, operacao, conduta, perfilIdeal, alertas } = dossie;

  return (
    <Caixa>
      <div className="vx-eyebrow" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Briefcase size={12} /> Especialidade
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{resumo.veredito}</div>

      <Narrativa leitura={dossie.narrativa} />

      <div className="vx-grid vx-g4">
        <Campo rotulo="Vende" valor={oferta.produto} />
        <Campo rotulo="Para quem" valor={oferta.icp} />
        <Campo rotulo="Ticket" valor={oferta.ticket} />
        <Campo rotulo="Segmento" valor={identidade.segmento} />
      </div>

      {(oferta.diferenciais !== "—" || oferta.objecoes !== "—") && (
        <div className="vx-grid" style={{ marginTop: 12, gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Campo rotulo="Diferenciais" valor={oferta.diferenciais} />
          <Campo rotulo="Objeções comuns" valor={oferta.objecoes} />
        </div>
      )}

      {/* O que a empresa precisa, derivado do ticket e das campanhas que ela
          mesma abriu — não do que ela diz precisar. */}
      <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)" }}>
        <div className="vx-eyebrow" style={{ marginBottom: 7 }}>Que vendedor serve aqui</div>
        <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-2)" }}>
          <b>{perfilIdeal.faixaDeTicket}.</b> {perfilIdeal.exigeDaOperacao}
        </div>
        {perfilIdeal.funcoesQueAbriu.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {perfilIdeal.funcoesQueAbriu.map((f) => <span key={f} className="vx-badge vx-badge-brand">{f}</span>)}
          </div>
        )}
        {perfilIdeal.sugestao && (
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 8 }}>
            Ainda não abriu campanha com função definida. Pelo ticket, o encaixe seria: <b>{perfilIdeal.sugestao}</b>.
          </div>
        )}
        {perfilIdeal.exigeCertificacao && (
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 6 }}>Exige profissional certificado.</div>
        )}
      </div>

      <div className="vx-grid vx-g4" style={{ marginTop: 14 }}>
        <Campo rotulo="Campanhas ativas" valor={`${operacao.campanhasAtivas} de ${operacao.campanhasTotais}`} />
        <Campo rotulo="Vagas abertas" valor={operacao.vagasAbertas} />
        <Campo rotulo="Ações recebidas" valor={conduta.acoesRecebidas} />
        <Campo rotulo="Aguardando conferência" valor={conduta.acoesAguardando} />
      </div>

      {/* Conduta: como essa empresa trata quem entrega. */}
      <div className="vx-grid vx-g4" style={{ marginTop: 12 }}>
        <Campo
          rotulo="Aprova"
          valor={conduta.taxaAprovacao === null ? "sem histórico" : `${conduta.taxaAprovacao}% do que recebe`}
        />
        <Campo
          rotulo="Confere em"
          valor={conduta.horasMediasParaDecidir === null ? "sem histórico" : `${conduta.horasMediasParaDecidir}h em média`}
        />
        <Campo rotulo="Saldo disponível" valor={conduta.saldoDisponivel?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Campo rotulo="Cadastro" valor={identidade.statusCadastro} />
      </div>

      <Alertas itens={alertas} />
    </Caixa>
  );
}
