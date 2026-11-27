import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Phone, Upload, Users, Info } from "lucide-react";
import { api } from "../../lib/api.js";
import { lerArquivoLeads, parseTabela, sugerirMapeamento } from "../../lib/importers.js";

// Configuração da discadora em 3 passos: subir a lista, marcar quem liga e
// testar com o próprio número. Fila, membros e ativação são criados por trás;
// os ajustes finos (horário, tentativas, várias filas) ficam na aba Avançado.

const LOTE = 1000; // limite de linhas por chamada do /leads/import
const soDigitos = (v) => String(v || "").replace(/\D/g, "");
const COLUNAS = [["nome", "Nome"], ["telefone", "Telefone"], ["empresa", "Empresa"]];
const ALVO = { minHeight: 44 };

function Passo({ n, titulo, feito, children }) {
  return (
    <section className="vx-card" style={{ padding: 18, marginBottom: 14 }} aria-labelledby={`disc-passo-${n}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, background: feito ? "var(--green-50)" : "var(--brand-50)", color: feito ? "var(--green)" : "var(--brand)" }}>
          {feito ? <CheckCircle2 size={16} /> : n}
        </span>
        <h3 id={`disc-passo-${n}`} style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{titulo}</h3>
      </div>
      {children}
    </section>
  );
}

export default function ConfigurarDiscadora({ time = [], filas = [], settings, aviso, onAtualizar }) {
  const [campanhas, setCampanhas] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [membros, setMembros] = useState([]);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [tabela, setTabela] = useState({ colunas: [], linhas: [] });
  const [mapa, setMapa] = useState({});
  const [ajustar, setAjustar] = useState(false);
  const [colar, setColar] = useState(false);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [resumo, setResumo] = useState("");
  const [telTeste, setTelTeste] = useState("");
  const [testando, setTestando] = useState(false);
  const [testeOk, setTesteOk] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get("/campaigns").then((cs) => {
      const lista = Array.isArray(cs) ? cs : [];
      setCampanhas(lista);
      // Começa pela campanha que já tem fila; senão, a mais recente.
      const comFila = lista.find((c) => filas.some((f) => f.campaignId === c.id));
      setCampaignId((atual) => atual || (comFila || lista[0])?.id || "");
    }).catch(() => {});
  }, []);

  const fila = useMemo(
    () => filas.find((f) => f.campaignId === campaignId && f.status === "ativa") || filas.find((f) => f.campaignId === campaignId) || null,
    [filas, campaignId]
  );
  const chaveTime = time.map((s) => s.id).join(",");

  const recarregarMembros = async (filaId) => {
    const m = await api.get(`/voice/queues/${filaId}/members`);
    setMembros(m);
    return m;
  };

  useEffect(() => {
    if (!fila) { setMembros([]); setSelecionados(new Set(time.map((s) => s.id))); return; }
    recarregarMembros(fila.id)
      .then((m) => setSelecionados(new Set(m.length ? m.map((x) => x.sellerId) : time.map((s) => s.id))))
      .catch(() => {});
  }, [fila?.id, chaveTime]);

  // ── Lista ──
  const normalizados = useMemo(() => tabela.linhas.map((l) => {
    const v = (campo) => (mapa[campo] >= 0 ? String(l[mapa[campo]] || "").trim() : "");
    return { nome: v("nome") || v("empresa"), empresa: v("empresa"), cargo: v("cargo"), telefone: v("telefone"), email: v("email") };
  }), [tabela, mapa]);
  const prontos = useMemo(() => normalizados.filter((l) => l.nome && soDigitos(l.telefone).length >= 8), [normalizados]);
  const deFora = normalizados.length - prontos.length;
  const faltaColuna = !!tabela.colunas.length && (mapa.telefone < 0 || (mapa.nome < 0 && mapa.empresa < 0));

  const aplicar = (t) => {
    if (!t.colunas.length || !t.linhas.length) return aviso?.("Não encontrei contatos nessa planilha.");
    setTabela(t); setMapa(sugerirMapeamento(t.colunas)); setAjustar(false); setResumo("");
  };
  const lerArquivo = async (file) => {
    if (!file) return;
    try { aplicar(await lerArquivoLeads(file)); } catch (e) { aviso?.(e.message); }
    if (fileRef.current) fileRef.current.value = "";
  };
  const baixarModelo = () => {
    const blob = new Blob(["nome;telefone;empresa;cargo;email\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "modelo-discadora-rycs.csv"; a.click(); URL.revokeObjectURL(a.href);
  };
  const limparLista = () => { setTabela({ colunas: [], linhas: [] }); setMapa({}); setTexto(""); setColar(false); };

  // ── Profissionais ──
  const alternar = (id) => setSelecionados((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todosMarcados = time.length > 0 && time.every((s) => selecionados.has(s.id));
  const marcarTodos = () => setSelecionados(todosMarcados ? new Set() : new Set(time.map((s) => s.id)));

  // ── Gravação ──
  const garantirFila = async () => {
    if (fila) return fila.id;
    const camp = campanhas.find((c) => c.id === campaignId);
    const r = await api.post("/voice/queues", { nome: `Discadora · ${camp?.titulo || "Campanha"}`, campaignId });
    return r.id;
  };

  const sincronizarMembros = async (filaId) => {
    const atuais = new Set(membros.map((m) => m.sellerId));
    const entrar = [...selecionados].filter((id) => !atuais.has(id));
    const sair = [...atuais].filter((id) => !selecionados.has(id));
    if (entrar.length) await api.post(`/voice/queues/${filaId}/members`, { sellerIds: entrar });
    for (const id of sair) await api.delete(`/voice/queues/${filaId}/members/${id}`);
  };

  const importarLista = async (filaId) => {
    let novos = 0, jaCadastrados = 0, naFila = 0;
    for (let i = 0; i < prontos.length; i += LOTE) {
      const r = await api.post("/leads/import", { campaignId, sellerIds: [...selecionados], linhas: prontos.slice(i, i + LOTE) });
      novos += r.importados || 0;
      jaCadastrados += (r.idsExistentes || []).length;
      const ids = [...(r.ids || []), ...(r.idsExistentes || [])];
      if (ids.length) naFila += (await api.post(`/voice/queues/${filaId}/leads`, { leadIds: ids })).adicionados || 0;
    }
    return { novos, jaCadastrados, naFila };
  };

  const ligarDiscadora = async () => { if (!settings?.ativo) await api.put("/voice/settings", { ativo: true }); };

  const salvar = async () => {
    if (!campaignId) return aviso?.("Escolha a campanha.");
    if (!selecionados.size) return aviso?.("Marque pelo menos um profissional.");
    if (tabela.linhas.length && !prontos.length) return aviso?.("Nenhuma linha com nome e telefone. Confira as colunas.");
    setSalvando(true);
    try {
      const filaId = await garantirFila();
      await sincronizarMembros(filaId);
      let msg = `${selecionados.size} profissional(is) liberado(s) para ligar.`;
      if (prontos.length) {
        const r = await importarLista(filaId);
        msg = `${r.naFila} contato(s) entraram na fila` +
          (r.jaCadastrados ? ` (${r.jaCadastrados} já estavam nos seus leads)` : "") +
          (deFora ? `. ${deFora} linha(s) sem nome ou telefone ficaram de fora` : "") +
          `. ${selecionados.size} profissional(is) liberado(s).`;
      }
      await ligarDiscadora();
      limparLista();
      setResumo(msg);
      aviso?.(msg);
      await recarregarMembros(filaId);
      await onAtualizar?.();
    } catch (e) {
      aviso?.("Erro: " + (e.message || "Falha ao salvar"));
    }
    setSalvando(false);
  };

  const testar = async () => {
    const tel = soDigitos(telTeste);
    if (tel.length < 10) return aviso?.("Digite seu celular com DDD.");
    if (!campaignId) return aviso?.("Escolha a campanha no passo 1.");
    const quem = membros[0]?.sellerId || [...selecionados][0];
    if (!quem) return aviso?.("Marque pelo menos um profissional no passo 2.");
    setTestando(true);
    try {
      const filaId = await garantirFila();
      if (!membros.length) await sincronizarMembros(filaId);
      const r = await api.post("/leads/import", { campaignId, sellerIds: [quem], linhas: [{ nome: "Teste da discadora", telefone: tel }] });
      const ids = [...(r.ids || []), ...(r.idsExistentes || [])];
      if (!ids.length) throw new Error("Não foi possível registrar o número de teste.");
      await api.post(`/voice/queues/${filaId}/leads`, { leadIds: ids, teste: true });
      await ligarDiscadora();
      setTesteOk(true);
      aviso?.("Seu número está no topo da fila.");
      await recarregarMembros(filaId);
      await onAtualizar?.();
    } catch (e) {
      aviso?.("Erro: " + (e.message || "Falha no teste"));
    }
    setTestando(false);
  };

  // ── Situação ──
  const pendentes = fila?.stats?.pendentes || 0;
  const status = [
    { ok: pendentes > 0, txt: pendentes > 0 ? `${pendentes} contato(s) para ligar` : "Lista ainda não enviada" },
    { ok: membros.length > 0, txt: membros.length ? `${membros.length} profissional(is) na discadora` : "Nenhum profissional liberado" },
    { ok: !!settings?.ativo, txt: settings?.ativo ? "Discadora ligada" : "Discadora liga ao salvar" },
  ];

  if (!campanhas.length) {
    return (
      <section className="vx-card" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Crie uma campanha primeiro</p>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>A lista da discadora fica ligada a uma campanha. Depois de criar, volte aqui para subir a lista.</p>
      </section>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div role="status" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {status.map((s) => (
          <span key={s.txt} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--radius-pill)", fontSize: 12, fontWeight: 600, background: s.ok ? "var(--green-50)" : "var(--surface-2)", color: s.ok ? "var(--green)" : "var(--muted)" }}>
            {s.ok && <CheckCircle2 size={13} aria-hidden="true" />} {s.txt}
          </span>
        ))}
      </div>

      {/* Passo 1 — Lista */}
      <Passo n={1} titulo="Suba a lista de contatos" feito={pendentes > 0}>
        {campanhas.length > 1 ? (
          <label style={{ display: "block", marginBottom: 12, maxWidth: 360 }}>
            <span className="vx-label">Campanha</span>
            <select className="vx-input" style={ALVO} value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setResumo(""); }}>
              {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </label>
        ) : (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>Campanha: <strong style={{ color: "var(--ink)" }}>{campanhas[0]?.titulo}</strong></p>
        )}

        {!tabela.colunas.length ? (
          <>
            <input ref={fileRef} id="disc-arquivo" hidden type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => lerArquivo(e.target.files?.[0])} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="vx-btn vx-btn-primary" style={ALVO} onClick={() => fileRef.current?.click()}>
                <Upload size={15} aria-hidden="true" /> Escolher planilha (Excel ou CSV)
              </button>
              <button type="button" className="vx-btn" style={ALVO} onClick={baixarModelo}>
                <Download size={15} aria-hidden="true" /> Baixar modelo
              </button>
              <button type="button" className="vx-btn" style={ALVO} aria-expanded={colar} onClick={() => setColar(!colar)}>
                Prefiro colar
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>Basta ter uma coluna de nome e uma de telefone. O resto é opcional.</p>
            {colar && (
              <div style={{ marginTop: 10 }}>
                <label htmlFor="disc-colar" className="vx-label">Cole a tabela (primeira linha com os títulos)</label>
                <textarea id="disc-colar" className="vx-input" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={"nome;telefone;empresa\nAna;11999999999;Clínica Vida"} />
                <button type="button" className="vx-btn" style={{ ...ALVO, marginTop: 8 }} onClick={() => aplicar(parseTabela(texto))}>Usar estes dados</button>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 14, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14 }}>
                <strong>{prontos.length}</strong> contato(s) prontos para ligar
                {deFora > 0 && <span style={{ color: "var(--muted)" }}> · {deFora} sem nome ou telefone (ficam de fora)</span>}
              </div>
              <button type="button" className="vx-btn" style={ALVO} onClick={limparLista}>Trocar planilha</button>
            </div>

            {(faltaColuna || ajustar) ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 12 }}>
                {faltaColuna && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, color: "var(--amber)" }}>Não achei sozinho a coluna de {mapa.telefone < 0 ? "telefone" : "nome"}. Escolha abaixo.</p>}
                {COLUNAS.map(([campo, label]) => (
                  <label key={campo}>
                    <span className="vx-label">{label}</span>
                    <select className="vx-input" style={ALVO} value={mapa[campo] ?? -1} onChange={(e) => setMapa({ ...mapa, [campo]: Number(e.target.value) })}>
                      <option value={-1}>Não tenho</option>
                      {tabela.colunas.map((c, i) => <option key={i} value={i}>{c}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => setAjustar(true)} style={{ ...ALVO, background: "none", border: "none", padding: 0, color: "var(--brand)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                Ajustar colunas
              </button>
            )}

            {prontos.length > 0 && (
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{COLUNAS.map(([, l]) => <th key={l} style={{ textAlign: "left", padding: "4px 6px", color: "var(--muted)", fontWeight: 600 }}>{l}</th>)}</tr>
                  </thead>
                  <tbody>
                    {prontos.slice(0, 3).map((l, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "4px 6px" }}>{l.nome}</td>
                        <td style={{ padding: "4px 6px" }}>{l.telefone}</td>
                        <td style={{ padding: "4px 6px", color: "var(--muted)" }}>{l.empresa || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {prontos.length > 3 && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>e mais {prontos.length - 3}. Contatos repetidos não são duplicados.</div>}
              </div>
            )}
          </div>
        )}
      </Passo>

      {/* Passo 2 — Profissionais */}
      <Passo n={2} titulo="Quem vai ligar" feito={membros.length > 0}>
        {!time.length ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Nenhum profissional aprovado no seu time ainda. Assim que você aprovar alguém, ele aparece aqui.</p>
        ) : (
          <>
            <button type="button" className="vx-btn" style={{ ...ALVO, marginBottom: 8 }} onClick={marcarTodos}>
              <Users size={15} aria-hidden="true" /> {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
              {time.map((s) => (
                <label key={s.id} style={{ ...ALVO, display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid", borderColor: selecionados.has(s.id) ? "var(--brand)" : "var(--border)", background: selecionados.has(s.id) ? "var(--brand-50)" : "var(--surface-solid)", cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={selecionados.has(s.id)} onChange={() => alternar(s.id)} style={{ width: 18, height: 18 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nome}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </Passo>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48, padding: "0 24px", fontSize: 15 }} disabled={salvando || !campaignId} onClick={salvar}>
          {salvando ? "Salvando…" : prontos.length ? `Subir ${prontos.length} contato(s) e liberar` : "Salvar profissionais"}
        </button>
        {resumo && <span role="status" style={{ fontSize: 13, color: "var(--green)" }}>{resumo}</span>}
      </div>

      {/* Passo 3 — Teste */}
      <Passo n={3} titulo="Teste com o seu celular" feito={testeOk}>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--muted)" }}>
          Seu número vai para o topo da fila. Quando um profissional abrir a Discadora e apertar <strong>Iniciar</strong>, a primeira ligação é para você.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ flex: "1 1 220px", maxWidth: 300 }}>
            <span className="vx-label">Seu celular com DDD</span>
            <input className="vx-input" style={ALVO} type="tel" inputMode="tel" autoComplete="tel" value={telTeste} onChange={(e) => { setTelTeste(e.target.value); setTesteOk(false); }} placeholder="(11) 99999-9999" />
          </label>
          <button type="button" className="vx-btn" style={ALVO} disabled={testando} onClick={testar}>
            <Phone size={15} aria-hidden="true" /> {testando ? "Colocando…" : "Colocar meu número no topo"}
          </button>
        </div>
        {testeOk && (
          <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--green)" }}>
            Pronto. Peça para um profissional marcado abrir a Discadora e apertar Iniciar.
          </p>
        )}
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)", display: "flex", gap: 6 }}>
          <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          O número aparece nos seus leads como "Teste da discadora". Para treinar sem ligar de verdade, o profissional escolhe "Simulação" ao lado do Iniciar.
        </p>
      </Passo>
    </div>
  );
}
