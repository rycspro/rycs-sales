import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Mic, Sparkles, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { PERMISSOES_MARCA, validarPerfilEmpresa, formatarTicket } from "../../../shared/onboarding.js";
import { SEGMENTOS_FLAT, nichosPorSegmento } from "../../../shared/segmentos.js";

const VAZIO = {
  nome: "", segmento: "", nicho: "", produto: "", ticket: "",
  servicos: [], diferencial: "", publico: "", regrasMarca: "", permissoesMarca: {},
};

const DEBOUNCE_MS = 1500;

function Campo({ id, label, obrigatorio, dica, erro, children }) {
  return (
    <div className="vx-onb-campo">
      <label className="vx-label" htmlFor={id}>
        {label}{obrigatorio ? <span aria-hidden="true" style={{ color: "var(--red)" }}> *</span> : <span className="vx-onb-opcional"> (recomendado)</span>}
      </label>
      {children}
      {dica && <div id={`${id}-dica`} className="vx-onb-dica">{dica}</div>}
      {erro && <div id={`${id}-erro`} className="vx-onb-erro" role="alert">{erro}</div>}
    </div>
  );
}

function SearchableSelect({ id, label, obrigatorio, erro, placeholder, opcoes, valor, onChange }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef(null);
  const listaRef = useRef(null);

  const labelSelecionado = opcoes.find((o) => (typeof o === "string" ? o : o.valor) === valor);
  const textoDisplay = labelSelecionado ? (typeof labelSelecionado === "string" ? labelSelecionado : labelSelecionado.label) : "";

  const filtrados = opcoes.filter((o) => {
    const texto = typeof o === "string" ? o : o.label;
    return texto.toLowerCase().includes(busca.toLowerCase());
  });

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (!ref.current?.contains(e.target)) setAberto(false); };
    document.addEventListener("pointerdown", fechar);
    return () => document.removeEventListener("pointerdown", fechar);
  }, [aberto]);

  const selecionar = (v) => {
    onChange(v);
    setAberto(false);
    setBusca("");
  };

  return (
    <Campo id={id} label={label} obrigatorio={obrigatorio} erro={erro}>
      <div className="vx-onb-searchselect" ref={ref} data-open={aberto ? "1" : "0"}>
        <input
          id={id}
          className="vx-input"
          value={aberto ? busca : textoDisplay}
          placeholder={placeholder}
          onChange={(e) => { setBusca(e.target.value); if (!aberto) setAberto(true); }}
          onFocus={() => { setAberto(true); setBusca(""); }}
          aria-invalid={erro ? true : undefined}
          aria-expanded={aberto}
          aria-haspopup="listbox"
          autoComplete="off"
        />
        <ChevronDown size={16} className="vx-onb-searchselect-chevron" aria-hidden="true" />
        {aberto && (
          <div className="vx-onb-searchselect-lista" ref={listaRef} role="listbox">
            {filtrados.length === 0 && <div className="vx-onb-searchselect-vazio">Nenhum resultado</div>}
            {filtrados.map((o) => {
              const v = typeof o === "string" ? o : o.valor;
              const t = typeof o === "string" ? o : o.label;
              return (
                <div key={v} className="vx-onb-searchselect-item" role="option"
                  data-ativo={v === valor ? "1" : "0"}
                  aria-selected={v === valor}
                  onClick={() => selecionar(v)}>{t}</div>
              );
            })}
          </div>
        )}
      </div>
    </Campo>
  );
}

export default function EtapaEmpresa({ aoAtualizar, aoAvancar, aoVoltar }) {
  const id = useId();
  const [dados, setDados] = useState(null);
  const [erroCarga, setErroCarga] = useState("");
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [autoSalvoEm, setAutoSalvoEm] = useState(null);
  const timerRef = useRef(null);
  const dadosRef = useRef(null);

  const carregar = async () => {
    setErroCarga("");
    setDados(null);
    const r = await api("/onboarding/empresa");
    if (!r || r.error) { setErroCarga(r?.error || "Não foi possível carregar o perfil."); return; }
    const d = {
      ...VAZIO, ...r,
      ticket: r.ticket == null ? "" : formatarTicket(r.ticket).replace("R$ ", ""),
      servicos: Array.isArray(r.servicos) ? r.servicos : [],
    };
    setDados(d);
    dadosRef.current = d;
  };
  useEffect(() => { carregar(); }, []);

  const salvarRascunho = useCallback(async (d) => {
    const r = await api("/onboarding/empresa", { ...d, concluir: false });
    if (r && !r.error) setAutoSalvoEm(new Date());
  }, []);

  const agendarAutoSave = useCallback((d) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => salvarRascunho(d), DEBOUNCE_MS);
  }, [salvarRascunho]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const mudar = (campo) => (e) => {
    const valor = e.target.value;
    setDados((d) => {
      const novo = { ...d, [campo]: valor };
      dadosRef.current = novo;
      agendarAutoSave(novo);
      return novo;
    });
    if (erros[campo]) setErros((x) => ({ ...x, [campo]: undefined }));
  };

  const mudarDireto = (campo, valor) => {
    setDados((d) => {
      const novo = { ...d, [campo]: valor };
      dadosRef.current = novo;
      agendarAutoSave(novo);
      return novo;
    });
    if (erros[campo]) setErros((x) => ({ ...x, [campo]: undefined }));
  };

  const alternarPermissao = (chave) =>
    setDados((d) => {
      const novo = { ...d, permissoesMarca: { ...d.permissoesMarca, [chave]: !d.permissoesMarca?.[chave] } };
      dadosRef.current = novo;
      agendarAutoSave(novo);
      return novo;
    });

  const salvar = async (concluirEtapa) => {
    setErroGeral("");
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (concluirEtapa) {
      const { erros: e } = validarPerfilEmpresa(dados);
      setErros(e);
      if (Object.keys(e).length) {
        setErroGeral("Revise os campos destacados.");
        document.getElementById(`${id}-${Object.keys(e)[0]}`)?.focus();
        return false;
      }
    }
    setSalvando(true);
    const r = await api("/onboarding/empresa", { ...dados, concluir: concluirEtapa });
    setSalvando(false);
    if (!r || r.error) {
      if (r?.erros) setErros(r.erros);
      setErroGeral(r?.error || "Não foi possível salvar. Seus dados continuam aqui; tente de novo.");
      return false;
    }
    aoAtualizar(r);
    return r;
  };

  const continuar = async (e) => {
    e.preventDefault();
    const r = await salvar(true);
    if (r) aoAvancar(r);
  };

  const voltar = async () => {
    if (dados) await salvar(false);
    aoVoltar();
  };

  // Serviços
  const addServico = () => {
    mudarDireto("servicos", [...(dados.servicos || []), { nome: "", valor: "" }]);
  };
  const mudarServico = (idx, campo, valor) => {
    const novos = [...(dados.servicos || [])];
    novos[idx] = { ...novos[idx], [campo]: valor };
    mudarDireto("servicos", novos);
  };
  const removerServico = (idx) => {
    mudarDireto("servicos", (dados.servicos || []).filter((_, i) => i !== idx));
  };

  // Nichos filtrados pelo segmento selecionado
  const nichosDisponiveis = dados?.segmento ? nichosPorSegmento(dados.segmento) : [];

  // IA auto-fill para produto
  const preencherComIA = async () => {
    if (!dados.segmento && !dados.nicho) return;
    const prompt = [dados.segmento, dados.nicho].filter(Boolean).join(" — ");
    mudarDireto("produto", `Gerando com IA com base em: ${prompt}…`);
    try {
      const r = await api("/onboarding/empresa/sugestao-produto", { segmento: dados.segmento, nicho: dados.nicho });
      if (r?.texto) mudarDireto("produto", r.texto);
      else mudarDireto("produto", "");
    } catch {
      mudarDireto("produto", "");
    }
  };

  // Voz (Web Speech API)
  const [gravando, setGravando] = useState(false);
  const recRef = useRef(null);
  const falarPorVoz = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (gravando && recRef.current) { recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    recRef.current = rec;
    rec.onresult = (ev) => {
      const texto = ev.results[0]?.[0]?.transcript || "";
      if (texto) mudarDireto("produto", (dados.produto ? dados.produto + " " : "") + texto);
    };
    rec.onend = () => setGravando(false);
    rec.onerror = () => setGravando(false);
    setGravando(true);
    rec.start();
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>Tentar novamente</button>
    </div>
  );
  if (!dados) return <div className="vx-onb-estado" role="status">Carregando o perfil…</div>;

  const props = (campo, extra = {}) => ({
    id: `${id}-${campo}`,
    className: "vx-input",
    value: dados[campo] ?? "",
    onChange: mudar(campo),
    "aria-invalid": erros[campo] ? true : undefined,
    "aria-describedby": erros[campo] ? `${id}-${campo}-erro` : extra.dica ? `${id}-${campo}-dica` : undefined,
    ...extra.input,
  });

  return (
    <div className="vx-onb-duas">
      <section className="vx-onb-hero">
        <div className="vx-onb-eyebrow">Passo 2 de 6</div>
        <h1 className="vx-disp">Conte sobre a sua empresa</h1>
        <p>A IA usa essas informações para montar scripts e funis que falam como a sua marca. Pode ir sem medo — você revisa tudo antes de ativar.</p>
        <ul className="vx-onb-proximos">
          <li><span>1</span> Segmento e nicho</li>
          <li><span>2</span> Produto e serviços</li>
          <li><span>3</span> Mercado e posicionamento</li>
          <li><span>4</span> Regras da marca</li>
        </ul>
        {autoSalvoEm && (
          <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
            Rascunho salvo às {autoSalvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </section>

      <section className="vx-onb-card">
        <form onSubmit={continuar} noValidate>
          <h2 className="vx-disp vx-onb-card-titulo">Perfil da empresa</h2>
          <p className="vx-mut vx-onb-card-apoio">Preencha o que souber — tudo salva automaticamente.</p>

          {/* Segmento e nicho */}
          <SearchableSelect
            id={`${id}-segmento`}
            label="Segmento"
            obrigatorio={false}
            erro={erros.segmento}
            placeholder="Selecione o segmento..."
            opcoes={SEGMENTOS_FLAT}
            valor={dados.segmento}
            onChange={(v) => { mudarDireto("segmento", v); if (dados.nicho) mudarDireto("nicho", ""); }}
          />

          <SearchableSelect
            id={`${id}-nicho`}
            label="Nicho"
            obrigatorio={false}
            erro={erros.nicho}
            placeholder={dados.segmento ? "Selecione o nicho..." : "Escolha o segmento primeiro"}
            opcoes={nichosDisponiveis}
            valor={dados.nicho}
            onChange={(v) => mudarDireto("nicho", v)}
          />

          {/* O que você vende */}
          <Campo id={`${id}-produto`} label="O que você vende" obrigatorio erro={erros.produto}>
            <div className="vx-onb-input-icons">
              <textarea {...props("produto")} rows={4} placeholder="O que é, para que serve e como funciona." maxLength={4000} />
              <div className="vx-onb-input-icones-wrap">
                {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                  <button type="button" className="vx-onb-input-icone" onClick={falarPorVoz}
                    title={gravando ? "Parar gravação" : "Falar por voz"}
                    style={gravando ? { borderColor: "var(--red)", color: "var(--red)" } : undefined}>
                    <Mic size={14} />
                  </button>
                )}
                <button type="button" className="vx-onb-input-icone" onClick={preencherComIA}
                  title="Preencher com IA" disabled={!dados.segmento && !dados.nicho}>
                  <Sparkles size={14} />
                </button>
              </div>
            </div>
          </Campo>

          <Campo id={`${id}-ticket`} label="Ticket médio" erro={erros.ticket} dica="Valor médio de uma venda.">
            <div className="vx-onb-moeda">
              <span aria-hidden="true">R$</span>
              <input {...props("ticket", { dica: true })} inputMode="decimal" placeholder="1.490,00" />
            </div>
          </Campo>

          {/* Serviços */}
          <div className="vx-onb-campo">
            <span className="vx-label">Serviços <span className="vx-onb-opcional">(recomendado)</span></span>
            {(dados.servicos || []).map((s, i) => (
              <div key={i} className="vx-onb-servico-row">
                <input className="vx-input" placeholder="Nome do serviço" value={s.nome}
                  onChange={(e) => mudarServico(i, "nome", e.target.value)} />
                <div className="vx-onb-moeda">
                  <span aria-hidden="true">R$</span>
                  <input className="vx-input" inputMode="decimal" placeholder="Valor"
                    value={s.valor} onChange={(e) => mudarServico(i, "valor", e.target.value)}
                    style={{ paddingLeft: 42 }} />
                </div>
                <button type="button" className="vx-onb-servico-rm" onClick={() => removerServico(i)} title="Remover serviço">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="vx-btn vx-btn-sm" onClick={addServico} style={{ marginTop: 4 }}>
              <Plus size={14} /> Adicionar serviço
            </button>
          </div>

          {/* Mercado e posicionamento */}
          <Campo id={`${id}-diferencial`} label="Diferencial" erro={erros.diferencial}>
            <textarea {...props("diferencial")} rows={3} placeholder="Por que o cliente escolhe vocês e não o concorrente." maxLength={4000} />
          </Campo>

          <Campo id={`${id}-publico`} label="Público" obrigatorio erro={erros.publico}>
            <textarea {...props("publico")} rows={3} placeholder="Quem compra: cargo, tipo de empresa ou perfil de pessoa." maxLength={4000} />
          </Campo>

          {/* Marca */}
          <Campo id={`${id}-regrasMarca`} label="Regras da marca" erro={erros.regrasMarca}
            dica="Tom de voz, o que sempre dizer e o que nunca dizer.">
            <textarea {...props("regrasMarca", { dica: true })} rows={3}
              placeholder="Ex.: tratamos o cliente por você; nunca prometemos prazo sem consultar a equipe." maxLength={4000} />
          </Campo>

          <fieldset className="vx-onb-permissoes">
            <legend className="vx-label">Permissões da marca: o que a IA pode fazer sozinha</legend>
            {PERMISSOES_MARCA.map((p) => (
              <label key={p.chave}>
                <input type="checkbox" checked={!!dados.permissoesMarca?.[p.chave]} onChange={() => alternarPermissao(p.chave)} />
                {p.label}
              </label>
            ))}
            <div className="vx-onb-dica">O que ficar desmarcado, a IA encaminha para uma pessoa da sua equipe.</div>
          </fieldset>

          <div aria-live="polite">{erroGeral && <div className="vx-onb-erro" role="alert">{erroGeral}</div>}</div>
          <div className="vx-onb-acoes">
            <button type="button" className="vx-btn" onClick={voltar} disabled={salvando}>Voltar</button>
            <button type="submit" className="vx-btn vx-btn-primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar e continuar"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
