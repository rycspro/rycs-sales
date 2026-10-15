import { useEffect, useId, useRef, useState } from "react";
import { UploadCloud, Trash2, Link2, FileText, Image, Video, Music, Presentation } from "lucide-react";
import { api, apiDelete, API_URL } from "../../lib/api.js";
import { CATEGORIAS_ACADEMY, validarArquivoAcademy, formatarTamanho, formatarWhatsapp, validarSuporte, normalizarLink } from "../../../shared/onboarding.js";

// Etapa 3: Marketing Academy. Todo o material de marketing e divulgação da
// empresa entra aqui; a IA da etapa 4 lê o que tiver texto. Nada é
// obrigatório, mas ao menos um material ou link é recomendado.

const ICONES = { apresentacao: Presentation, material: FileText, foto: Image, video: Video, audio: Music };

// XHR em vez de fetch: é o que expõe o progresso do envio.
function enviarArquivo(categoria, arquivo, aoProgresso) {
  return new Promise((ok) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/onboarding/academy/arquivos/${categoria}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", arquivo.type || "application/octet-stream");
    xhr.setRequestHeader("X-Arquivo-Nome", encodeURIComponent(arquivo.name));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) aoProgresso(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let corpo = null;
      try { corpo = JSON.parse(xhr.responseText); } catch { /* resposta sem JSON */ }
      ok(xhr.status >= 200 && xhr.status < 300 ? corpo : { error: corpo?.error || "Não foi possível enviar o arquivo. Tente de novo." });
    };
    xhr.onerror = () => ok({ error: "Falha de conexão durante o envio. Tente de novo." });
    xhr.send(arquivo);
  });
}

function CartaoEnvio({ categoria, materiais, disponivel, aoEnviado, aoRemover }) {
  const id = useId();
  const input = useRef(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState([]); // { chave, nome, progresso, erro }
  const Icone = ICONES[categoria.chave];

  const receber = (lista) => {
    for (const arquivo of Array.from(lista || [])) {
      const chave = `${arquivo.name}-${arquivo.size}-${Math.random()}`;
      const erro = validarArquivoAcademy({ categoria: categoria.chave, nome: arquivo.name, tamanho: arquivo.size });
      setEnviando((e) => [...e, { chave, nome: arquivo.name, progresso: 0, erro }]);
      if (erro) continue;
      enviarArquivo(categoria.chave, arquivo, (p) =>
        setEnviando((e) => e.map((x) => (x.chave === chave ? { ...x, progresso: p } : x)))
      ).then((r) => {
        if (r?.error) return setEnviando((e) => e.map((x) => (x.chave === chave ? { ...x, erro: r.error } : x)));
        setEnviando((e) => e.filter((x) => x.chave !== chave));
        aoEnviado(r);
      });
    }
    if (input.current) input.current.value = "";
  };

  return (
    <section className="vx-onb-card vx-onb-envio" aria-labelledby={`${id}-t`}>
      <div className="vx-onb-envio-topo">
        <span className="vx-onb-icone" aria-hidden="true"><Icone size={20} /></span>
        <div>
          <h2 id={`${id}-t`} className="vx-disp">{categoria.label}</h2>
          <div className="vx-onb-dica" id={`${id}-d`}>{categoria.formatos.map((f) => f.toUpperCase()).join(", ")} · até {formatarTamanho(categoria.limite)} por arquivo</div>
        </div>
      </div>
      {disponivel && (
        <div className="vx-onb-soltar" data-ativo={arrastando ? "1" : "0"}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); receber(e.dataTransfer.files); }}>
          <UploadCloud size={20} aria-hidden="true" />
          <span>Arraste aqui ou</span>
          <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} aria-describedby={`${id}-d`} onClick={() => input.current?.click()}>
            Escolher arquivos
          </button>
          <input ref={input} type="file" hidden multiple accept={categoria.formatos.map((f) => `.${f}`).join(",")} onChange={(e) => receber(e.target.files)} />
        </div>
      )}
      <ul className="vx-onb-arquivos" aria-live="polite">
        {enviando.map((x) => (
          <li key={x.chave} data-erro={x.erro ? "1" : "0"}>
            <span className="vx-onb-arquivo-nome">{x.nome}</span>
            {x.erro
              ? <><span className="vx-onb-erro-inline" role="alert">{x.erro}</span>
                  <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" aria-label={`Dispensar ${x.nome}`} onClick={() => setEnviando((e) => e.filter((y) => y.chave !== x.chave))}>Dispensar</button></>
              : <progress max={100} value={x.progresso} aria-label={`Enviando ${x.nome}`}>{x.progresso}%</progress>}
          </li>
        ))}
        {materiais.map((m) => (
          <li key={m.id}>
            <span className="vx-onb-arquivo-nome">{m.nome}</span>
            <span className="vx-onb-dica" style={{ margin: 0 }}>{formatarTamanho(m.tamanho)}</span>
            <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} aria-label={`Remover ${m.nome}`} onClick={() => aoRemover(m)}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function EtapaAcademy({ aoAtualizar, aoAvancar, aoVoltar }) {
  const id = useId();
  const [dados, setDados] = useState(null);
  const [erroCarga, setErroCarga] = useState("");
  const [link, setLink] = useState("");
  const [erroLink, setErroLink] = useState("");
  const [suporte, setSuporte] = useState({ nome: "", whatsapp: "", email: "" });
  const [errosSuporte, setErrosSuporte] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setErroCarga("");
    setDados(null);
    const r = await api("/onboarding/academy");
    if (!r || r.error) return setErroCarga(r?.error || "Não foi possível carregar os materiais.");
    setDados(r);
    setSuporte({ ...r.suporte, whatsapp: r.suporte.whatsapp ? formatarWhatsapp(r.suporte.whatsapp) : "" });
  };
  useEffect(() => { carregar(); }, []);

  const adicionar = (m) => setDados((d) => ({ ...d, materiais: [...d.materiais, m] }));
  const remover = async (m) => {
    const r = await apiDelete(`/onboarding/academy/materiais/${m.id}`);
    if (!r?.ok) return setErroGeral(r?.error || "Não foi possível remover. Tente de novo.");
    setDados((d) => ({ ...d, materiais: d.materiais.filter((x) => x.id !== m.id) }));
  };

  const adicionarLink = async (e) => {
    e.preventDefault();
    setErroLink("");
    if (!normalizarLink(link)) return setErroLink("Informe um link válido, como https://suaempresa.com.br.");
    const r = await api("/onboarding/academy/links", { url: link });
    if (!r || r.error) return setErroLink(r?.error || "Não foi possível adicionar o link.");
    adicionar(r);
    setLink("");
  };

  const concluir = async () => {
    setErroGeral("");
    const { erros } = validarSuporte(suporte);
    setErrosSuporte(erros);
    if (Object.keys(erros).length) return setErroGeral("Revise o contato de suporte.");
    setSalvando(true);
    const r = await api("/onboarding/academy/concluir", { suporte });
    setSalvando(false);
    if (!r || r.error) {
      if (r?.erros) setErrosSuporte(r.erros);
      return setErroGeral(r?.error || "Não foi possível continuar. Tente de novo.");
    }
    aoAtualizar(r);
    aoAvancar(r);
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>Tentar novamente</button>
    </div>
  );
  if (!dados) return <div className="vx-onb-estado" role="status">Carregando os materiais…</div>;

  const links = dados.materiais.filter((m) => m.categoria === "link");
  const mudarSuporte = (campo) => (e) => {
    setSuporte((s) => ({ ...s, [campo]: e.target.value }));
    if (errosSuporte[campo]) setErrosSuporte((x) => ({ ...x, [campo]: undefined }));
  };

  return (
    <div>
      <div className="vx-onb-eyebrow">Passo 3 de 6</div>
      <h1 className="vx-disp vx-onb-titulo">Marketing Academy: seus materiais</h1>
      <p className="vx-mut vx-onb-card-apoio">Tudo o que a sua empresa usa para vender e divulgar: apresentações, materiais, fotos, vídeos, áudios e links. A IA lê esses materiais para conhecer o seu negócio.</p>

      {!dados.armazenamento && (
        <div className="vx-onb-aviso" role="status">O envio de arquivos ainda não está disponível. Você pode adicionar links, o contato de suporte e seguir; os arquivos podem ser enviados depois.</div>
      )}

      <div className="vx-onb-grade-envio">
        {CATEGORIAS_ACADEMY.map((c) => (
          <CartaoEnvio key={c.chave} categoria={c} disponivel={dados.armazenamento}
            materiais={dados.materiais.filter((m) => m.categoria === c.chave)} aoEnviado={adicionar} aoRemover={remover} />
        ))}

        <section className="vx-onb-card vx-onb-envio" aria-labelledby={`${id}-links`}>
          <div className="vx-onb-envio-topo">
            <span className="vx-onb-icone" aria-hidden="true"><Link2 size={20} /></span>
            <div>
              <h2 id={`${id}-links`} className="vx-disp">Links</h2>
              <div className="vx-onb-dica">Site, redes, catálogo, YouTube, páginas de venda.</div>
            </div>
          </div>
          <form onSubmit={adicionarLink} className="vx-onb-linha" noValidate>
            <label className="vx-label" htmlFor={`${id}-url`} style={{ position: "absolute", left: -9999 }}>Endereço do link</label>
            <input id={`${id}-url`} className="vx-input" type="url" inputMode="url" placeholder="https://" value={link}
              onChange={(e) => { setLink(e.target.value); setErroLink(""); }} aria-invalid={erroLink ? true : undefined} aria-describedby={erroLink ? `${id}-url-erro` : undefined} />
            <button type="submit" className="vx-btn" style={{ minHeight: 48 }}>Adicionar</button>
          </form>
          {erroLink && <div id={`${id}-url-erro`} className="vx-onb-erro" role="alert">{erroLink}</div>}
          <ul className="vx-onb-arquivos">
            {links.map((m) => (
              <li key={m.id}>
                <a className="vx-onb-arquivo-nome" href={m.url} target="_blank" rel="noopener noreferrer">{m.url}</a>
                <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} aria-label={`Remover ${m.url}`} onClick={() => remover(m)}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-sup`} style={{ marginTop: 16 }}>
        <h2 id={`${id}-sup`} className="vx-disp">Contato de suporte</h2>
        <p className="vx-mut" style={{ marginTop: -8, fontSize: 14 }}>Para quem a IA encaminha a conversa quando precisar de uma pessoa.</p>
        <div className="vx-onb-tres">
          {[["nome", "Nome", "text", "name"], ["whatsapp", "WhatsApp", "tel", "tel-national"], ["email", "E-mail", "email", "email"]].map(([campo, label, tipo, auto]) => (
            <div className="vx-onb-campo" key={campo}>
              <label className="vx-label" htmlFor={`${id}-s-${campo}`}>{label}</label>
              <input id={`${id}-s-${campo}`} className="vx-input" type={tipo} autoComplete={auto} value={suporte[campo]} onChange={mudarSuporte(campo)}
                aria-invalid={errosSuporte[campo] ? true : undefined} aria-describedby={errosSuporte[campo] ? `${id}-s-${campo}-erro` : undefined} />
              {errosSuporte[campo] && <div id={`${id}-s-${campo}-erro`} className="vx-onb-erro" role="alert">{errosSuporte[campo]}</div>}
            </div>
          ))}
        </div>
      </section>

      {dados.materiais.length === 0 && <div className="vx-onb-aviso">Recomendado: envie ao menos um material ou link. A IA trabalha melhor com eles, mas dá para seguir sem.</div>}
      <div aria-live="polite">{erroGeral && <div className="vx-onb-erro" role="alert">{erroGeral}</div>}</div>
      <div className="vx-onb-acoes">
        <button type="button" className="vx-btn" onClick={aoVoltar} disabled={salvando}>Voltar</button>
        <button type="button" className="vx-btn vx-btn-primary" onClick={concluir} disabled={salvando}>
          {salvando ? "Enviando…" : "Enviar para a IA analisar"}
        </button>
      </div>
    </div>
  );
}
