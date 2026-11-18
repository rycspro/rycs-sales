import { useState, useEffect } from "react";
import {
  Gift, Copy, Clock, CheckCircle2, TrendingUp, Building2, Users, Percent,
  Lock, Trophy, Rocket, DollarSign, Hourglass,
} from "lucide-react";
import { api } from "../lib/api.js";
import { money, dataCurta } from "../lib/utils.js";
import { ROTAS } from "../lib/rotas.js";

const PAPEL = { empresa: "Empresa", vendedor: "Profissional" };
const AZUL = "#318CE7";

// Central de Afiliados — "Indique. Evolua. Ganhe." Combina o compartilhamento do
// código/link (dados de /referrals) com a Jornada de Indicações gamificada
// (dados reais de /afiliados/resumo). Enquanto o programa progressivo não é
// ativado, a trilha é apresentada como prévia e a política vigente (30% da
// primeira mensalidade) é a que efetivamente paga.
export default function Indicacoes({ aviso }) {
  const [dados, setDados] = useState(null);
  const [afil, setAfil] = useState(null);

  useEffect(() => {
    api("/referrals").then((r) => { if (r && !r.error) setDados(r); });
    api("/afiliados/resumo").then((r) => { if (r && !r.error) setAfil(r); });
  }, []);

  if (!dados) return <div className="vx-mut" style={{ padding: 20 }}>Carregando…</div>;

  const link = `${window.location.origin}${ROTAS.cadastroVendedor}?ref=${dados.codigo}`;
  const linkEmpresa = `${window.location.origin}${ROTAS.onboarding}?ref=${dados.codigo}`;
  const indicaEmpresa = !!dados.recompensas?.empresa;
  const prof = dados.profissionais;
  const ind = afil?.indicadores;

  const copiar = async (texto, oque) => {
    try { await navigator.clipboard.writeText(texto); aviso(`${oque} copiado.`); }
    catch { aviso("Não foi possível copiar. Selecione e copie manualmente."); }
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 820 }}>
      {/* ───────────── Cabeçalho ───────────── */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, flex: "none", background: "rgba(49,140,231,.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Rocket size={23} color={AZUL} strokeWidth={2.1} />
        </div>
        <div>
          <h1 className="vx-disp" style={{ fontSize: 24, margin: 0 }}>Indique. Evolua. Ganhe.</h1>
          <p className="vx-mut" style={{ fontSize: 13.5, margin: "4px 0 0", lineHeight: 1.55, maxWidth: 560 }}>
            Compartilhe a RYCS, conquiste clientes e desbloqueie comissões maiores conforme sua jornada.
          </p>
        </div>
      </div>

      {/* ───────────── Indicadores ───────────── */}
      {ind && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 12, marginBottom: 16 }}>
          <Indicador Icon={DollarSign} rotulo="Comissões recebidas" valor={money(ind.comissoesRecebidas)} cor={AZUL} />
          <Indicador Icon={CheckCircle2} rotulo="Disponíveis" valor={money(ind.comissoesDisponiveis)} cor="var(--green, #22c55e)" />
          <Indicador Icon={Hourglass} rotulo="Pendentes" valor={money(ind.comissoesPendentes)} cor="var(--amber)" />
          <Indicador Icon={Building2} rotulo="Empresas indicadas" valor={ind.empresasIndicadas} />
          <Indicador Icon={Users} rotulo="Clientes pagantes" valor={ind.clientesPagantes} />
          <Indicador Icon={Percent} rotulo="Percentual atual" valor={`${ind.percentualAtual}%`} cor={AZUL} />
        </div>
      )}

      {/* ───────────── Jornada / trilha de níveis ───────────── */}
      {afil?.trilha?.length > 0 && (
        <div className="vx-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
            <div className="vx-eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={14} /> Jornada de Indicações
            </div>
            {!afil.ativo && (
              <span className="vx-badge" style={{ fontSize: 11 }}>Prévia · níveis em preparação</span>
            )}
          </div>
          {afil.proximoNivel ? (
            <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 16px", lineHeight: 1.5 }}>
              Você está a <b style={{ color: "var(--ink)" }}>{afil.proximoNivel.faltam}</b>{" "}
              {afil.proximoNivel.faltam === 1 ? "cliente pagante" : "clientes pagantes"} de desbloquear o nível{" "}
              <b style={{ color: AZUL }}>{afil.proximoNivel.nome}</b>.
            </p>
          ) : (
            <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 16px" }}>Você alcançou o nível máximo da jornada. Parabéns!</p>
          )}

          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {afil.trilha.map((n) => <CartaoNivel key={n.chave} n={n} />)}
          </div>
          <p className="vx-mut" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
            Os percentuais por nível são uma prévia configurável e dependem de aprovação. A comissão sempre
            considera o valor efetivamente pago do plano. Hoje vale a política vigente de{" "}
            {afil.politicaVigente?.percentual}% da primeira mensalidade.
          </p>
        </div>
      )}

      {/* ───────────── Código + links ───────────── */}
      <div className="vx-card" style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 13, alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, flex: "none", background: "var(--brand-50)", border: "1px solid var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Gift size={21} color="var(--brand)" strokeWidth={2.1} />
          </div>
          <div>
            <div className="vx-eyebrow">Seu convite</div>
            <div className="vx-disp" style={{ fontSize: 19, marginTop: 2 }}>Compartilhe seu código</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <span className="vx-mono vx-disp" style={{ fontSize: 23, letterSpacing: ".12em", color: "var(--brand)" }}>{dados.codigo}</span>
          <button className="vx-btn vx-btn-sm" onClick={() => copiar(dados.codigo, "Código")}>
            <Copy size={13} /> Copiar
          </button>
        </div>

        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10, minHeight: 44 }}
          onClick={() => copiar(link, "Link de convite")}>
          {dados.recompensas?.vendedor ? "Copiar link para profissionais" : "Copiar link de convite"}
        </button>
        {indicaEmpresa && dados.recompensas?.vendedor && (
          <button className="vx-btn vx-btn-block" style={{ marginTop: 8, minHeight: 44 }}
            onClick={() => copiar(linkEmpresa, "Link para empresas")}>
            Copiar link para empresas
          </button>
        )}
        {prof && dados.recompensas?.vendedor && (
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
            {prof.qualificados} {prof.qualificados === 1 ? "profissional indicado completou" : "profissionais indicados completaram"} o perfil.
            Faltam {prof.faltam} para o próximo bônus.
          </p>
        )}
      </div>

      {/* ───────────── Quanto vale cada indicação ───────────── */}
      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 16, marginBottom: 10 }}>Quanto vale cada indicação</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(dados.recompensas).map(([papel, r]) => (
            <div key={papel} className="vx-row" style={{ fontSize: 13.5 }}>
              <div>
                <b>{PAPEL[papel] || papel}</b>
                <div className="vx-mut" style={{ fontSize: 12 }}>{r.descricao || `Liberado após ${dados.gatilhos[papel]}`}</div>
              </div>
              <b className="vx-mono" style={{ color: "var(--brand)" }}>{money(r.valor)}{r.percentual ? ` + ${Math.round(r.percentual * 100)}%` : ""}</b>
            </div>
          ))}
        </div>
        <p className="vx-mut" style={{ fontSize: 12, marginTop: 14 }}>
          {dados.recompensas?.vendedor
            ? "Cadastro sozinho não gera recompensa: a empresa precisa ter o cadastro aprovado, e o profissional precisa completar o perfil. Cada recompensa é paga uma única vez."
            : "A recompensa não é paga por cadastro. Ela entra quando quem você indicou contrata um plano elegível e o pagamento é confirmado. Cadastro sem pagamento não gera comissão."}
        </p>
      </div>

      {/* ───────────── Minhas empresas indicadas ───────────── */}
      {afil?.empresas?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>
            Minhas empresas indicadas ({afil.empresas.length})
          </h3>
          <div className="vx-grid" style={{ gap: 10 }}>
            {afil.empresas.map((e, i) => <CartaoEmpresa key={e.companyId || i} e={e} />)}
          </div>
        </div>
      )}

      {/* ───────────── Lista geral de indicações ───────────── */}
      <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>
        Suas indicações {dados.indicacoes.length > 0 && `(${dados.indicacoes.length})`}
      </h3>
      {dados.indicacoes.length === 0 ? (
        <div className="vx-card vx-mut" style={{ padding: 20, fontSize: 13.5, textAlign: "center" }}>
          Ninguém se cadastrou com seu código ainda.
        </div>
      ) : (
        <div className="vx-grid">
          {dados.indicacoes.map((i, idx) => {
            const pago = i.status === "pago" || i.status === "qualificada";
            return (
              <div key={idx} className="vx-card vx-row" style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  {pago ? <CheckCircle2 size={17} color="var(--brand)" style={{ flex: "none" }} /> : <Clock size={17} color="var(--amber)" style={{ flex: "none" }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{i.contato}</div>
                    <div className="vx-mut" style={{ fontSize: 11.5 }}>{PAPEL[i.papel] || i.papel} · {dataCurta(i.criadoEm)}</div>
                  </div>
                </div>
                <span className={"vx-badge " + (pago ? "vx-badge-brand" : "vx-badge-amber")}>
                  {i.status === "qualificada" ? "Perfil completo" : pago ? money(i.valor) : "Pendente"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Indicador({ Icon, rotulo, valor, cor }) {
  return (
    <div className="vx-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Icon size={15} color={cor || "var(--muted)"} />
        <div className="vx-mut" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".04em" }}>{rotulo}</div>
      </div>
      <div className="vx-disp vx-mono" style={{ fontSize: 21, color: cor || "var(--ink)" }}>{valor}</div>
    </div>
  );
}

// Emblema de nível com placeholder (nenhuma imagem é gerada automaticamente;
// o admin poderá cadastrar as imagens depois — usamos troféu/cadeado por ora).
function CartaoNivel({ n }) {
  const ativo = n.desbloqueado;
  return (
    <div style={{
      flex: "0 0 auto", width: 128, textAlign: "center", padding: "14px 10px", borderRadius: 14,
      border: `1.5px solid ${n.atual ? AZUL : "var(--border, #e5e7eb)"}`,
      background: n.atual ? "rgba(49,140,231,.06)" : "var(--surface, #fff)",
      opacity: ativo ? 1 : 0.6,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%", margin: "0 auto 8px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: ativo ? "rgba(49,140,231,.12)" : "var(--surface-2)",
        color: ativo ? AZUL : "var(--muted-2)",
      }}>
        {n.emblema
          ? <img src={n.emblema} alt={n.nome} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
          : ativo ? <Trophy size={24} /> : <Lock size={22} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{n.nome}</div>
      <div className="vx-mono" style={{ fontSize: 15, color: ativo ? AZUL : "var(--muted)", fontWeight: 700 }}>{n.pct}%</div>
      <div className="vx-mut" style={{ fontSize: 11 }}>{n.min === 0 ? "início" : `${n.min}+ clientes`}</div>
      {n.atual && <div style={{ fontSize: 10.5, fontWeight: 700, color: AZUL, marginTop: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>Nível atual</div>}
    </div>
  );
}

// Linha do tempo de uma empresa indicada — estados correspondem a eventos reais.
function CartaoEmpresa({ e }) {
  const etapas = [
    { chave: "cadastro", rotulo: "Cadastro", ok: e.linhaDoTempo?.cadastro },
    { chave: "aprovado", rotulo: "Aprovado", ok: e.linhaDoTempo?.aprovado },
    { chave: "pagamento", rotulo: "Pagamento", ok: e.linhaDoTempo?.pagamentoConfirmado },
    { chave: "comissao", rotulo: "Comissão", ok: e.linhaDoTempo?.comissaoConstituida },
  ];
  return (
    <div className="vx-card" style={{ padding: 14 }}>
      <div className="vx-row" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <Building2 size={17} color={e.pagante ? "var(--brand)" : "var(--muted-2)"} style={{ flex: "none" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nome}</div>
            <div className="vx-mut" style={{ fontSize: 11.5 }}>{dataCurta(e.criadoEm)}</div>
          </div>
        </div>
        <span className={"vx-badge " + (e.comissaoRecebida > 0 ? "vx-badge-brand" : e.pagante ? "vx-badge-brand" : "")}>
          {e.comissaoRecebida > 0 ? money(e.comissaoRecebida) : e.pagante ? "Pagante" : "Sem pagamento"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {etapas.map((et, i) => (
          <div key={et.chave} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: "none" }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%", flex: "none",
                background: et.ok ? AZUL : "var(--surface-2)",
                border: `1.5px solid ${et.ok ? AZUL : "var(--border, #e5e7eb)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {et.ok && <CheckCircle2 size={11} color="#fff" />}
              </div>
              <span style={{ fontSize: 9.5, color: et.ok ? "var(--ink-2)" : "var(--muted-2)" }}>{et.rotulo}</span>
            </div>
            {i < etapas.length - 1 && (
              <div style={{ height: 2, flex: 1, borderRadius: 2, background: et.ok ? AZUL : "var(--surface-2)", marginBottom: 14 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
