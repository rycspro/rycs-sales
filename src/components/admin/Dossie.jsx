import { useState, useEffect } from "react";
import { Sparkles, AlertTriangle, Target, Briefcase, Brain, TrendingUp, User, CheckCircle2, XCircle, Zap } from "lucide-react";
import { api } from "../../lib/api.js";
import { Medidor } from "../ui.jsx";

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
    <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--brand-50)", border: "1px solid var(--brand-100)", marginBottom: 16 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 6, color: "var(--brand)", display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={13} /> Análise do perfil
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-2)" }}>{texto}</div>
      <div className="vx-mut" style={{ fontSize: 10.5, marginTop: 10, fontStyle: "italic" }}>
        {ORIGEM[fonte] || ORIGEM.interno} Texto auxiliar: nenhuma decisão da plataforma depende dele.
      </div>
    </div>
  );
}

function Alertas({ itens }) {
  if (!itens?.length) return null;
  return (
    <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(240,180,94,.08)", border: "1px solid rgba(240,180,94,.2)" }}>
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
  const [estado, setEstado] = useState({ carregando: true, dossie: null, erro: null, vendedor: null });
  useEffect(() => {
    let vivo = true;
    setEstado({ carregando: true, dossie: null, erro: null, vendedor: null });
    api(rota).then((r) => {
      if (!vivo) return;
      if (!r || r.error) setEstado({ carregando: false, dossie: null, erro: r?.error || "Não foi possível carregar o dossiê.", vendedor: null });
      else setEstado({ carregando: false, dossie: r.dossie, erro: null, vendedor: r.vendedor || null });
    });
    return () => { vivo = false; };
  }, [rota]);
  return estado;
}

const Caixa = ({ children }) => (
  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>{children}</div>
);

const vazioMesmo = (v) => v === null || v === undefined || v === "" ||
  (Array.isArray(v) && v.length === 0);

const Campo = ({ rotulo, valor, icone }) => (
  <div>
    <span className="vx-mut" style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}>
      {icone}{rotulo}
    </span>
    <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.5 }}>
      {vazioMesmo(valor) ? "—" : valor}
    </div>
  </div>
);

function PerfilDisc({ disc }) {
  if (!disc) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Brain size={12} /> Perfil DISC
      </div>

      {/* Perfil principal */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, padding: "14px 16px", borderRadius: 12, background: "var(--surface-2)" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${disc.corPredominante}22, ${disc.corSecundario}22)`,
          border: `3px solid ${disc.corPredominante}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 800, color: disc.corPredominante,
        }}>
          {disc.label}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>
            <span style={{ color: disc.corPredominante }}>{disc.nomePredominante}</span>
            <span style={{ color: "var(--muted)", fontWeight: 400 }}> + </span>
            <span style={{ color: disc.corSecundario }}>{disc.nomeSecundario}</span>
          </div>
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
            {disc.descricaoPredominante}
          </div>
        </div>
      </div>

      {/* Barras de dimensão */}
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {Object.entries(disc.percentuais || {}).map(([dim, pct]) => {
          const cor = { D: "#E53E3E", I: "#DD6B20", S: "#38A169", C: "#3182CE" }[dim] || "#666";
          const nome = { D: "Dominância", I: "Influência", S: "Estabilidade", C: "Conformidade" }[dim] || dim;
          return (
            <div key={dim} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 18, fontSize: 13, fontWeight: 700, color: cor, textAlign: "center" }}>{dim}</div>
              <div style={{ width: 80, fontSize: 11.5, color: "var(--text-2)" }}>{nome}</div>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--surface-3)" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: cor, transition: "width .5s ease" }} />
              </div>
              <div className="vx-mono" style={{ width: 36, fontSize: 12, fontWeight: 600, textAlign: "right", color: cor }}>{pct}%</div>
            </div>
          );
        })}
      </div>

      {/* Estilo de venda */}
      {disc.tracos?.estilo && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: `${disc.corPredominante}08`, border: `1px solid ${disc.corPredominante}20`, marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: disc.corPredominante, marginBottom: 4 }}>Estilo de venda</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--text-2)" }}>{disc.tracos.estilo}</div>
        </div>
      )}

      {/* Pontos fortes e riscos */}
      {disc.tracos && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 4, color: "var(--green, #22c55e)" }}>
              <CheckCircle2 size={12} /> Pontos fortes
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 12, lineHeight: 1.7, color: "var(--text-2)" }}>
              {disc.tracos.positivos.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 4, color: "var(--amber, #f59e0b)" }}>
              <AlertTriangle size={12} /> Pontos de atenção
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 12, lineHeight: 1.7, color: "var(--text-2)" }}>
              {disc.tracos.riscos.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Compatibilidade */}
      {disc.compatibilidade && (
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--muted)", padding: "8px 12px", borderRadius: 8, background: "var(--surface-2)" }}>
          <Zap size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
          <b>Campanhas ideais:</b> {disc.compatibilidade.campanhas}
        </div>
      )}
    </div>
  );
}

function ExperienciaDetalhada({ experiencia }) {
  if (!experiencia) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <TrendingUp size={12} /> Experiência profissional
      </div>
      <div className="vx-grid vx-g4" style={{ fontSize: 12.5 }}>
        <Campo rotulo="Tempo em vendas" valor={experiencia.anos} />
        <Campo rotulo="Tipo de venda" valor={experiencia.tipoVenda} />
        <Campo rotulo="Dedicação" valor={experiencia.dedicacao} />
        <Campo rotulo="Canais" valor={experiencia.canais?.length ? experiencia.canais.join(", ") : "—"} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- profissional

export function DossieProfissional({ sellerId }) {
  const { carregando, dossie, erro, vendedor } = useDossie(`/triagem/${sellerId}/dossie`);

  if (carregando) return <Caixa><div className="vx-mut" style={{ fontSize: 12.5 }}>Montando o dossiê…</div></Caixa>;
  if (erro) return <Caixa><div className="vx-mut" style={{ fontSize: 12.5 }}>{erro}</div></Caixa>;

  const { resumo, categorias, funcoes, declarado, alertas } = dossie;
  const isDISC = dossie.fonte === "disc";

  return (
    <Caixa>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div className="vx-eyebrow" style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <Target size={12} /> Dossiê completo
        </div>
        {resumo.faixa && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
            background: resumo.score >= 80 ? "var(--brand-50)" : resumo.score >= 60 ? "rgba(245,158,11,.1)" : "rgba(239,68,68,.08)",
            color: resumo.score >= 80 ? "var(--brand)" : resumo.score >= 60 ? "var(--amber, #f59e0b)" : "var(--red, #ef4444)",
            textTransform: "capitalize",
          }}>
            {resumo.faixa}
          </span>
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>{resumo.veredito}</div>

      {/* Bio do vendedor (se disponível) */}
      {vendedor?.bio && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", marginBottom: 14 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <User size={11} /> Sobre o profissional
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--text-2)" }}>{vendedor.bio}</div>
        </div>
      )}

      {/* Narrativa IA */}
      <Narrativa leitura={dossie.narrativa} />

      {/* Perfil DISC detalhado (quando disponível) */}
      {isDISC && <PerfilDisc disc={dossie.disc} />}

      {/* Experiência detalhada (quando DISC) */}
      {isDISC && <ExperienciaDetalhada experiencia={dossie.experiencia} />}

      {/* Prontidão por função */}
      <div style={{ marginBottom: 16 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Briefcase size={12} /> Prontidão por função
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {funcoes.map((f) => (
            <div key={f.funcao} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              borderRadius: 10, background: "var(--surface-2)",
            }}>
              <div style={{ width: 62, fontSize: 13, fontWeight: 700 }}>{f.nome}</div>
              <div style={{ flex: 1 }}>
                <Medidor value={f.cobertura} tone={f.cobertura >= 75 ? "brand" : f.cobertura >= 50 ? "amber" : "red"} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                background: f.veredito === "pronto" ? "rgba(34,197,94,.1)" : f.veredito === "com acompanhamento" ? "rgba(245,158,11,.1)" : "rgba(239,68,68,.08)",
                color: f.veredito === "pronto" ? "var(--green, #22c55e)" : f.veredito === "com acompanhamento" ? "var(--amber, #f59e0b)" : "var(--red, #ef4444)",
              }}>
                {f.veredito}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Entrega hoje / Não entrega ainda */}
      {(resumo.entregaHoje?.length > 0 || resumo.naoEntregaAinda?.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          {resumo.entregaHoje?.length > 0 && (
            <div>
              <div className="vx-eyebrow" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 4, color: "var(--green, #22c55e)" }}>
                <CheckCircle2 size={11} /> Entrega hoje
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.85, color: "var(--text-2)" }}>
                {resumo.entregaHoje.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          {resumo.naoEntregaAinda?.length > 0 && (
            <div>
              <div className="vx-eyebrow" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 4, color: "var(--red, #ef4444)" }}>
                <XCircle size={11} /> Ainda não entrega
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.85, color: "var(--muted)" }}>
                {resumo.naoEntregaAinda.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Dados declarados (triagem antiga) */}
      {!isDISC && (
        <div className="vx-grid vx-g4" style={{ marginBottom: 14 }}>
          <Campo rotulo="Ticket máximo" valor={declarado.ticketMaximo} />
          <Campo rotulo="Capacidade/dia" valor={declarado.capacidadeDiaria} />
          <Campo rotulo="Velocidade de contato" valor={declarado.velocidadeContato} />
          <Campo rotulo="Segmentos" valor={declarado.segmentos?.join(", ")} />
        </div>
      )}

      {/* Categorias / Dimensões */}
      <div style={{ marginBottom: 14 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 8 }}>{isDISC ? "Dimensões DISC" : "Por categoria"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {categorias.map((c) => (
            <div key={c.chave} style={{ padding: "8px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
              <div className="vx-row" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: c.cor || "var(--text-2)" }}>{c.nome}</span>
                <b className="vx-mono" style={{ fontSize: 12.5, color: c.cor || "inherit" }}>{c.valor}%</b>
              </div>
              <Medidor value={c.valor} tone={c.leitura === "forte" ? "brand" : c.leitura === "mediano" ? "amber" : "red"} />
            </div>
          ))}
        </div>
      </div>

      {/* Recomendação */}
      {dossie.recomendacao && (
        <div style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 14 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 4 }}>Recomendação</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" }}>{dossie.recomendacao.texto}</div>
        </div>
      )}

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
