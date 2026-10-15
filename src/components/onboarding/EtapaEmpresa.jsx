import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { PERMISSOES_MARCA, validarPerfilEmpresa, formatarTicket, LOGO_MAX_BYTES, avaliarLogo } from "../../../shared/onboarding.js";

// Etapa 2: perfil da empresa. É daqui que a IA da etapa 4 tira o tom da marca,
// o que pode e o que não pode dizer. Obrigatórios: nome, produto e público.

const VAZIO = { nome: "", produto: "", ticket: "", nicho: "", diferencial: "", publico: "", regrasMarca: "", permissoesMarca: {} };

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

const lerArquivo = (arquivo) => new Promise((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => falha(r.error);
  r.readAsDataURL(arquivo);
});

export default function EtapaEmpresa({ aoAtualizar, aoAvancar, aoVoltar }) {
  const id = useId();
  const inputLogo = useRef(null);
  const [dados, setDados] = useState(null); // null = carregando
  const [erroCarga, setErroCarga] = useState("");
  const [logo, setLogo] = useState("");
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [erroLogo, setErroLogo] = useState("");
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setErroCarga("");
    setDados(null);
    const r = await api("/onboarding/empresa");
    if (!r || r.error) { setErroCarga(r?.error || "Não foi possível carregar o perfil."); return; }
    setLogo(r.logo || "");
    setDados({ ...VAZIO, ...r, ticket: r.ticket == null ? "" : formatarTicket(r.ticket).replace("R$ ", "") });
  };
  useEffect(() => { carregar(); }, []);

  const mudar = (campo) => (e) => {
    const valor = e.target.value;
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((x) => ({ ...x, [campo]: undefined }));
  };
  const alternarPermissao = (chave) =>
    setDados((d) => ({ ...d, permissoesMarca: { ...d.permissoesMarca, [chave]: !d.permissoesMarca?.[chave] } }));

  const enviarLogo = async (arquivo) => {
    if (!arquivo) return;
    setErroLogo("");
    const svgTexto = arquivo.type === "image/svg+xml" ? await arquivo.text() : "";
    const erro = avaliarLogo({ mimetype: arquivo.type, tamanhoBytes: arquivo.size, svgTexto });
    if (erro) { setErroLogo(erro); return; }
    setEnviandoLogo(true);
    try {
      const dataUri = await lerArquivo(arquivo);
      const r = await api("/onboarding/empresa/logo", { base64: dataUri.split(",")[1], mimetype: arquivo.type });
      if (!r || r.error) setErroLogo(r?.error || "Não foi possível enviar o logo. Tente de novo.");
      else setLogo(r.logo);
    } catch {
      setErroLogo("Não foi possível ler o arquivo. Tente outro.");
    }
    setEnviandoLogo(false);
    if (inputLogo.current) inputLogo.current.value = "";
  };

  const removerLogo = async () => {
    setEnviandoLogo(true);
    const r = await api("/onboarding/empresa/logo", { remover: true });
    setEnviandoLogo(false);
    if (r?.ok) setLogo("");
    else setErroLogo(r?.error || "Não foi possível remover o logo.");
  };

  const salvar = async (concluirEtapa) => {
    setErroGeral("");
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

  // Voltar guarda o rascunho antes, para nada do que foi digitado se perder.
  const voltar = async () => {
    if (dados) await salvar(false);
    aoVoltar();
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
  const texto = (campo, placeholder, dica) => (
    <textarea {...props(campo, { dica })} rows={4} placeholder={placeholder} maxLength={4000} />
  );

  return (
    <form className="vx-onb-perfil" onSubmit={continuar} noValidate>
      <div>
        <div className="vx-onb-eyebrow">Passo 2 de 6</div>
        <h1 className="vx-disp vx-onb-titulo">Conte quem é a sua empresa</h1>
        <p className="vx-mut vx-onb-card-apoio">A IA usa estas respostas para falar como a sua marca. Pode escrever do seu jeito, sem se preocupar com formato.</p>

        <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-s1`}>
          <h2 id={`${id}-s1`} className="vx-disp">Identidade</h2>
          <div className="vx-onb-campo">
            <span className="vx-label" id={`${id}-logo-rotulo`}>Logo <span className="vx-onb-opcional">(recomendado)</span></span>
            <div className="vx-onb-logo">
              <div className="vx-onb-logo-previa" aria-hidden={!logo}>
                {logo ? <img src={logo} alt="Logo atual da empresa" /> : <ImagePlus size={22} aria-hidden="true" />}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="vx-btn" style={{ minHeight: 44 }} disabled={enviandoLogo}
                  aria-describedby={`${id}-logo-rotulo ${id}-logo-dica`} onClick={() => inputLogo.current?.click()}>
                  {enviandoLogo ? "Enviando…" : logo ? "Trocar logo" : "Enviar logo"}
                </button>
                {logo && (
                  <button type="button" className="vx-btn vx-btn-ghost" style={{ minHeight: 44 }} disabled={enviandoLogo} onClick={removerLogo}>
                    <Trash2 size={15} aria-hidden="true" /> Remover
                  </button>
                )}
              </div>
              <input ref={inputLogo} type="file" hidden accept="image/png,image/svg+xml,image/jpeg,image/webp"
                onChange={(e) => enviarLogo(e.target.files?.[0])} />
            </div>
            <div id={`${id}-logo-dica`} className="vx-onb-dica">PNG ou SVG, de preferência com fundo transparente. Até {Math.round(LOGO_MAX_BYTES / 1024 / 1024)} MB.</div>
            {erroLogo && <div className="vx-onb-erro" role="alert">{erroLogo}</div>}
          </div>
          <Campo id={`${id}-nome`} label="Nome da empresa" obrigatorio erro={erros.nome}>
            <input {...props("nome")} autoComplete="organization" maxLength={100} />
          </Campo>
        </section>

        <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-s2`}>
          <h2 id={`${id}-s2`} className="vx-disp">O que você vende</h2>
          <Campo id={`${id}-produto`} label="Produto e serviço" obrigatorio erro={erros.produto}>
            {texto("produto", "O que é, para que serve e como funciona.")}
          </Campo>
          <Campo id={`${id}-ticket`} label="Ticket do produto" erro={erros.ticket} dica="Valor médio de uma venda.">
            <div className="vx-onb-moeda">
              <span aria-hidden="true">R$</span>
              <input {...props("ticket", { dica: true })} inputMode="decimal" placeholder="1.490,00" />
            </div>
          </Campo>
        </section>

        <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-s3`}>
          <h2 id={`${id}-s3`} className="vx-disp">Mercado e posicionamento</h2>
          <Campo id={`${id}-nicho`} label="Detalhes do nicho" erro={erros.nicho}>
            {texto("nicho", "Segmento, região, porte dos clientes, sazonalidade.")}
          </Campo>
          <Campo id={`${id}-diferencial`} label="Diferencial" erro={erros.diferencial}>
            {texto("diferencial", "Por que o cliente escolhe vocês e não o concorrente.")}
          </Campo>
          <Campo id={`${id}-publico`} label="Público" obrigatorio erro={erros.publico}>
            {texto("publico", "Quem compra: cargo, tipo de empresa ou perfil de pessoa.")}
          </Campo>
        </section>

        <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-s4`}>
          <h2 id={`${id}-s4`} className="vx-disp">Marca</h2>
          <Campo id={`${id}-regrasMarca`} label="Regras da marca" erro={erros.regrasMarca}
            dica="Tom de voz, o que sempre dizer e o que nunca dizer.">
            {texto("regrasMarca", "Ex.: tratamos o cliente por você; nunca prometemos prazo sem consultar a equipe.", true)}
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
        </section>

        <div aria-live="polite">{erroGeral && <div className="vx-onb-erro" role="alert">{erroGeral}</div>}</div>
        <div className="vx-onb-acoes">
          <button type="button" className="vx-btn" onClick={voltar} disabled={salvando}>Voltar</button>
          <button type="submit" className="vx-btn vx-btn-primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar e continuar"}</button>
        </div>
      </div>

      <aside className="vx-onb-lateral">
        <div className="vx-onb-card">
          <h2 className="vx-disp">Por que perguntamos</h2>
          <p className="vx-mut">Quanto mais claro o perfil, mais fiel é o script que a IA cria na etapa 4. Você poderá revisar tudo antes de aprovar.</p>
          <h3 className="vx-onb-eyebrow" style={{ marginTop: 16 }}>Nesta etapa</h3>
          <ul>
            <li>Logo e nome</li>
            <li>Produto, serviço e ticket</li>
            <li>Nicho, diferencial e público</li>
            <li>Regras e permissões da marca</li>
          </ul>
        </div>
      </aside>
    </form>
  );
}
