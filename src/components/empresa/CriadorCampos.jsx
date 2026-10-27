import { useState } from "react";
import { BookTemplate, GripVertical, Plus, Save, Trash2 } from "lucide-react";

export const TIPOS_CAMPO = [
  { id: "texto",          nome: "Texto livre" },
  { id: "numerico",       nome: "Numérico" },
  { id: "telefone",       nome: "Telefone" },
  { id: "cpf",            nome: "CPF" },
  { id: "cnpj",           nome: "CNPJ" },
  { id: "data",           nome: "Data" },
  { id: "datahora",       nome: "Data e hora" },
  { id: "selecao_unica",  nome: "Seleção única" },
  { id: "multipla",       nome: "Múltipla escolha" },
  { id: "upload_imagem",  nome: "Upload de imagem" },
  { id: "upload_arquivo", nome: "Upload de arquivo" },
  { id: "assinatura",     nome: "Assinatura" },
];

function novoCampo() {
  return { id: `campo_${Date.now()}_${Math.random().toString(36).slice(2)}`, nome: "", tipo: "texto", obrigatorio: false, opcoes: [] };
}

function CampoEditor({ campo, onChange, onRemover }) {
  const precisaOpcoes = ["selecao_unica", "multipla"].includes(campo.tipo);

  return (
    <div className="vx-card" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <GripVertical size={16} color="var(--muted)" style={{ marginTop: 10, cursor: "grab", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="vx-grid vx-g3" style={{ marginBottom: 8 }}>
            <label><span className="vx-label">Nome do campo *</span>
              <input className="vx-input" value={campo.nome} onChange={(e) => onChange({ ...campo, nome: e.target.value })} placeholder="Ex: CPF do cliente" />
            </label>
            <label><span className="vx-label">Tipo</span>
              <select className="vx-input" value={campo.tipo} onChange={(e) => onChange({ ...campo, tipo: e.target.value })}>
                {TIPOS_CAMPO.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 22 }}>
              <input type="checkbox" checked={campo.obrigatorio} onChange={(e) => onChange({ ...campo, obrigatorio: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Obrigatório</span>
            </label>
          </div>
          {precisaOpcoes && (
            <div>
              <div className="vx-label">Opções (uma por linha)</div>
              <textarea className="vx-input" rows={3} style={{ fontSize: 12 }}
                value={(campo.opcoes || []).join("\n")}
                onChange={(e) => onChange({ ...campo, opcoes: e.target.value.split("\n").filter(Boolean) })}
                placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
              />
            </div>
          )}
        </div>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginTop: 8 }} onClick={onRemover}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

export default function CriadorCampos({ campos = [], modelos = [], onChange, onSalvarModelo, tarefa = "" }) {
  const [lista, setLista] = useState(campos.map((c) => ({ ...c })));
  const [nomeModelo, setNomeModelo] = useState("");
  const [salvandoModelo, setSalvandoModelo] = useState(false);

  const atualizar = (i, novoCampoData) => {
    const nova = lista.map((c, idx) => idx === i ? novoCampoData : c);
    setLista(nova);
    onChange?.(nova);
  };

  const adicionar = () => {
    const nova = [...lista, novoCampo()];
    setLista(nova);
    onChange?.(nova);
  };

  const remover = (i) => {
    const nova = lista.filter((_, idx) => idx !== i);
    setLista(nova);
    onChange?.(nova);
  };

  const carregarModelo = (modelo) => {
    const novos = modelo.campos.map((c) => ({ ...c, id: `${c.id}_${Date.now()}` }));
    const nova = [...lista, ...novos];
    setLista(nova);
    onChange?.(nova);
  };

  const salvarComoModelo = () => {
    if (!nomeModelo.trim()) return;
    onSalvarModelo?.({ nome: nomeModelo, campos: lista, tarefa });
    setSalvandoModelo(false);
    setNomeModelo("");
  };

  return (
    <div>
      {modelos.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="vx-label">Usar modelo salvo</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {modelos.map((m, i) => (
              <button key={i} className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => carregarModelo(m)}>
                <BookTemplate size={12} /> {m.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {lista.map((campo, i) => (
        <CampoEditor key={campo.id} campo={campo} onChange={(c) => atualizar(i, c)} onRemover={() => remover(i)} />
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button className="vx-btn vx-btn-sm" onClick={adicionar}><Plus size={13} /> Adicionar campo</button>
        {lista.length > 0 && !salvandoModelo && (
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setSalvandoModelo(true)}>
            <Save size={12} /> Salvar como modelo
          </button>
        )}
      </div>

      {salvandoModelo && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
          <input className="vx-input" style={{ maxWidth: 220 }} value={nomeModelo} onChange={(e) => setNomeModelo(e.target.value)} placeholder="Nome do modelo" />
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={salvarComoModelo} disabled={!nomeModelo.trim()}>Salvar</button>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setSalvandoModelo(false)}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

// Renderizador de campos personalizados em formulário de tarefa
export function FormularioCampos({ campos = [], valores = {}, onChange, disabled = false }) {
  const set = (id, valor) => onChange?.({ ...valores, [id]: valor });

  return (
    <div>
      {campos.map((campo) => {
        const v = valores[campo.id] ?? "";
        const label = <span className="vx-label">{campo.nome}{campo.obrigatorio && <span style={{ color: "var(--danger)" }}> *</span>}</span>;

        if (campo.tipo === "texto") return (
          <label key={campo.id} style={{ display: "block", marginBottom: 10 }}>
            {label}<textarea className="vx-input" rows={2} value={v} onChange={(e) => set(campo.id, e.target.value)} disabled={disabled} />
          </label>
        );

        if (["numerico", "telefone", "cpf", "cnpj"].includes(campo.tipo)) return (
          <label key={campo.id} style={{ display: "block", marginBottom: 10 }}>
            {label}<input className="vx-input vx-mono" value={v} onChange={(e) => set(campo.id, e.target.value)} disabled={disabled}
              inputMode={campo.tipo === "numerico" ? "decimal" : "tel"} placeholder={campo.tipo === "cpf" ? "000.000.000-00" : campo.tipo === "cnpj" ? "00.000.000/0000-00" : ""} />
          </label>
        );

        if (["data", "datahora"].includes(campo.tipo)) return (
          <label key={campo.id} style={{ display: "block", marginBottom: 10 }}>
            {label}<input className="vx-input" type={campo.tipo === "datahora" ? "datetime-local" : "date"} value={v} onChange={(e) => set(campo.id, e.target.value)} disabled={disabled} />
          </label>
        );

        if (campo.tipo === "selecao_unica") return (
          <label key={campo.id} style={{ display: "block", marginBottom: 10 }}>
            {label}
            <select className="vx-input" value={v} onChange={(e) => set(campo.id, e.target.value)} disabled={disabled}>
              <option value="">Selecione</option>
              {(campo.opcoes || []).map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </label>
        );

        if (campo.tipo === "multipla") return (
          <div key={campo.id} style={{ marginBottom: 10 }}>
            {label}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {(campo.opcoes || []).map((op) => {
                const sels = Array.isArray(v) ? v : [];
                const marcado = sels.includes(op);
                return (
                  <label key={op} style={{ display: "flex", gap: 6, alignItems: "center", cursor: disabled ? "default" : "pointer" }}>
                    <input type="checkbox" checked={marcado} disabled={disabled}
                      onChange={() => set(campo.id, marcado ? sels.filter((x) => x !== op) : [...sels, op])} />
                    {op}
                  </label>
                );
              })}
            </div>
          </div>
        );

        if (["upload_imagem", "upload_arquivo"].includes(campo.tipo)) return (
          <label key={campo.id} style={{ display: "block", marginBottom: 10 }}>
            {label}
            <input className="vx-input" type="file" accept={campo.tipo === "upload_imagem" ? "image/*" : "*"} disabled={disabled}
              onChange={(e) => set(campo.id, e.target.files?.[0]?.name || "")} />
            {v && <div className="vx-mut" style={{ fontSize: 11, marginTop: 2 }}>{v}</div>}
          </label>
        );

        if (campo.tipo === "assinatura") return (
          <div key={campo.id} style={{ marginBottom: 10 }}>
            {label}
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>
              Assinatura digital · implementação via upload de imagem
            </div>
          </div>
        );

        return null;
      })}
    </div>
  );
}
