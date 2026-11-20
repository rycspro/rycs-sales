// Formulário que liga a chave "Colaborador interno" para um usuário.
// Usado na aba Colaboradores e na ficha do profissional (seção 1 da spec).
import { useState } from "react";
import { api } from "../../lib/api.js";
import { VINCULOS, REGIMES, presencaPadrao } from "../../../shared/colaboradores.js";
import { ALVO, DiasPrevistos } from "./comum.jsx";

const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

function Campo({ id, label, children, ajuda }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="vx-label" htmlFor={id}>{label}</label>
      {children}
      {ajuda && <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>{ajuda}</div>}
    </div>
  );
}

export default function FormAtivacao({ usuario, aviso, pronto, cancelar, prefixo = "n" }) {
  const [f, setF] = useState({
    nome: usuario.nomeProfissional || "", cpf: usuario.documento || "", funcao: "", vinculo: "clt", regime: "presencial",
    dataInicio: hoje(), jornadaHoras: "44", dias: [1, 2, 3, 4, 5],
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const id = (k) => `${prefixo}-${k}`;
  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const r = await api("/admin/colaboradores", {
      userId: usuario.id, nome: f.nome, cpf: f.cpf, funcao: f.funcao, vinculo: f.vinculo, regime: f.vinculo === "clt" ? f.regime : "",
      dataInicio: f.dataInicio, jornadaHoras: f.jornadaHoras, regra: { diasPrevistos: f.dias, medirPresenca: presencaPadrao(f.vinculo, f.regime) },
    });
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    aviso(r.contrato?.erro ? `Colaborador ativado. ${r.contrato.erro}` : "Colaborador ativado e contrato enviado para assinatura.");
    pronto?.(r.colaborador.id);
  };
  return (
    <form onSubmit={salvar} style={{ marginTop: 12 }}>
      <p className="vx-mut" style={{ fontSize: 13 }}>Conta: <b>{usuario.email}</b>{cancelar && <> <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={ALVO} onClick={cancelar}>Cancelar</button></>}</p>
      <div className="vx-g2" style={{ gap: 12 }}>
        <Campo id={id("nome")} label="Nome completo"><input id={id("nome")} className="vx-input" required value={f.nome} onChange={(e) => set("nome", e.target.value)} style={ALVO} /></Campo>
        <Campo id={id("cpf")} label="CPF"><input id={id("cpf")} className="vx-input" inputMode="numeric" value={f.cpf} onChange={(e) => set("cpf", e.target.value)} style={ALVO} /></Campo>
        <Campo id={id("funcao")} label="Função (cargo)"><input id={id("funcao")} className="vx-input" value={f.funcao} onChange={(e) => set("funcao", e.target.value)} style={ALVO} /></Campo>
        <Campo id={id("vinculo")} label="Tipo de vínculo">
          <select id={id("vinculo")} className="vx-input" value={f.vinculo} onChange={(e) => set("vinculo", e.target.value)} style={ALVO}>
            {Object.entries(VINCULOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        {f.vinculo === "clt" && (
          <Campo id={id("regime")} label="Regime de trabalho" ajuda="Vai para o contrato. Defina com o advogado.">
            <select id={id("regime")} className="vx-input" value={f.regime} onChange={(e) => set("regime", e.target.value)} style={ALVO}>
              {Object.entries(REGIMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
        )}
        <Campo id={id("inicio")} label="Data real de início do trabalho" ajuda="O vínculo vale desde o primeiro dia trabalhado, não da assinatura.">
          <input id={id("inicio")} type="date" className="vx-input" required value={f.dataInicio} onChange={(e) => set("dataInicio", e.target.value)} style={ALVO} />
        </Campo>
        <Campo id={id("jornada")} label="Jornada (horas por semana)"><input id={id("jornada")} className="vx-input" inputMode="decimal" value={f.jornadaHoras} onChange={(e) => set("jornadaHoras", e.target.value)} style={ALVO} /></Campo>
      </div>
      <DiasPrevistos valor={f.dias} onChange={(d) => set("dias", d)} />
      {f.vinculo !== "clt" && <div className="vx-notice vx-notice-amber" style={{ margin: "8px 0" }}>Sem vínculo empregatício: presença, faltas e meta diária ficam desligadas por padrão (seção 13.1). Ligue só depois de falar com o advogado.</div>}
      <button className="vx-btn vx-btn-primary" style={{ ...ALVO, marginTop: 8 }} disabled={salvando}>{salvando ? "Ativando…" : "Ativar colaborador"}</button>
    </form>
  );
}
