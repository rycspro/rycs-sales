import { useState } from "react";
import { Trash2, Eye, EyeOff } from "lucide-react";
import { STATUS } from "../lib/constants.js";
import { apiDeleteStatus } from "../lib/api.js";

export function Selo({ s }) {
  const v = STATUS[s] || STATUS.analisando;
  const Icon = v.Icon;
  return (
    <span className={`vx-badge vx-badge-${v.tone}`}>
      <Icon size={12} strokeWidth={2.5} />{v.txt}
    </span>
  );
}

export function Medidor({ value, tone = "brand" }) {
  const cor = { brand: "var(--brand)", amber: "var(--amber)", red: "var(--red)", indigo: "var(--indigo)", muted: "var(--muted-2)" }[tone] || "var(--brand)";
  return (
    <div className="vx-meter-track">
      <div className="vx-meter-fill" style={{ width: `${Math.max(3, Math.min(100, value))}%`, background: cor }} />
    </div>
  );
}

export function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="vx-label">{label}</label>
      {children}
    </div>
  );
}

// Campo de senha com o olho para mostrar ou ocultar. O botão fica dentro do
// campo, com alvo de toque de 44px e rótulo que muda junto com o estado.
export function CampoSenha({ id, value, onChange, placeholder, autoComplete = "current-password", minLength, required = true, invalido = false, descricao }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="vx-senha">
      <input id={id} className="vx-input" type={visivel ? "text" : "password"} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete} minLength={minLength} required={required}
        aria-invalid={invalido || undefined} aria-describedby={descricao} />
      <button type="button" className="vx-senha-olho" onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visivel}>
        {visivel ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function Vazio({ titulo, texto, acao }) {
  return (
    <div className="vx-card" style={{ padding: 26, textAlign: "center" }}>
      <div className="vx-disp" style={{ fontSize: 18, marginBottom: 6 }}>{titulo}</div>
      <p className="vx-mut" style={{ margin: "0 0 14px", fontSize: 13.5 }}>{texto}</p>
      {acao}
    </div>
  );
}

export function Stat({ label, value, Icon, tone = "brand", mono = true }) {
  const bg = { brand: "var(--brand-100)", amber: "var(--amber-100)", red: "var(--red-100)", indigo: "var(--indigo-100)", muted: "var(--surface-2)" }[tone];
  const fg = { brand: "var(--brand)", amber: "var(--amber)", red: "var(--red)", indigo: "var(--indigo)", muted: "var(--muted)" }[tone];
  return (
    <div className="vx-stat">
      {Icon && <div className="vx-stat-icon" style={{ background: bg }}><Icon size={16} color={fg} strokeWidth={2.3} /></div>}
      <div className="vx-eyebrow" style={{ marginBottom: 3 }}>{label}</div>
      <div className={"vx-stat-val" + (mono ? " vx-mono" : "")}>{value}</div>
    </div>
  );
}

export function Donut({ titulo, itens = [], centro, legenda = true, formatar }) {
  const cores = ["var(--brand)", "var(--indigo)", "var(--amber)", "var(--red)", "var(--muted)", "#2DBE91"];
  const total = itens.reduce((s, i) => s + Number(i.valor || 0), 0);
  // Sem formatador, o valor sai cru — que é o certo para contagens e errado
  // para dinheiro. Quem sabe qual é o caso é a tela que chama.
  const rotular = formatar || ((v) => v);
  let cursor = 0;
  const stops = total ? itens.map((item, i) => {
    const inicio = cursor;
    cursor += Number(item.valor || 0) / total * 100;
    return `${item.cor || cores[i % cores.length]} ${inicio}% ${cursor}%`;
  }).join(",") : "var(--surface-3) 0 100%";
  return <div className="vx-card vx-chart-card">
    <div className="vx-row"><b>{titulo}</b><span className="vx-chip vx-mono">{rotular(total)}</span></div>
    <div className="vx-donut-layout">
      <div className="vx-donut" role="img" aria-label={`${titulo}: ${total} registros`} style={{ background: `conic-gradient(${stops})` }}>
        <div><strong className="vx-mono">{centro ?? rotular(total)}</strong><span>total</span></div>
      </div>
      {legenda && <div className="vx-chart-legend">{itens.length ? itens.map((item, i) => <div key={`${item.nome}-${i}`} title={item.fonte || `${item.valor} registro(s)`}><i style={{ background: item.cor || cores[i % cores.length] }} /><span>{item.nome}</span><b className="vx-mono">{rotular(item.valor)}{total ? ` · ${Math.round(item.valor / total * 100)}%` : ""}</b></div>) : <span className="vx-mut">Sem registros no filtro</span>}</div>}
    </div>
    <div className="vx-chart-source">Fonte: registros operacionais filtrados da empresa</div>
  </div>;
}

// Exclusão definitiva, em dois estágios: o primeiro clique arma, o segundo
// executa. Quando o servidor recusa por valores em aberto (409), o motivo
// aparece aqui mesmo e o botão passa a oferecer a exclusão forçada.
//
// Um confirm() do browser esconderia justamente o número que a plataforma
// precisa ler antes de decidir — e há navegadores que o suprimem sem avisar.
export function Excluir({ rota, label, conflito, sucesso, onRemovido, aviso }) {
  const [armado, setArmado] = useState(false);
  const [pendencia, setPendencia] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const cancelar = () => { setArmado(false); setPendencia(null); };

  const excluir = async (forcar) => {
    setExcluindo(true);
    const { status, corpo } = await apiDeleteStatus(`${rota}${forcar ? "?forcar=true" : ""}`);
    setExcluindo(false);

    if (status === 409) return setPendencia(corpo);
    if (status !== 200) return aviso?.(corpo.error || "Não foi possível excluir.");

    cancelar();
    onRemovido?.();
    // A mensagem vem de quem chama: um nome de pessoa não diz o gênero
    // dela, e uma frase fixa acabaria escolhendo um por conta própria.
    aviso?.(sucesso);
  };

  if (!armado)
    return (
      <button className="vx-btn" onClick={() => { setArmado(true); setPendencia(null); }} style={{ color: "var(--red)" }}>
        <Trash2 size={14} /> {label}
      </button>
    );

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, color: "var(--red)", flex: 1, minWidth: 190 }}>
        {pendencia ? conflito(pendencia) : "Apaga o cadastro e todo o histórico ligado a ele. Não tem volta."}
      </span>
      <button className="vx-btn" onClick={cancelar} disabled={excluindo}>Cancelar</button>
      <button className="vx-btn vx-btn-danger" onClick={() => excluir(!!pendencia)} disabled={excluindo}>
        {excluindo ? "Excluindo…" : pendencia ? "Excluir mesmo assim" : "Confirmar exclusão"}
      </button>
    </div>
  );
}
