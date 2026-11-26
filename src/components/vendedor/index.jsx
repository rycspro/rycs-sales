import { ArrowLeft } from "lucide-react";
import { useState, useEffect, lazy, Suspense } from "react";
// As duas telas iniciais do profissional (painel e oportunidades) carregam
// junto; as demais vêm sob demanda, para o carregamento inicial no celular ficar
// mais leve.
import PainelVendedor from "./PainelVendedor.jsx";
import Oportunidades from "./Oportunidades.jsx";
const MinhaConta = lazy(() => import("../conta/MinhaConta.jsx"));
const AtividadeProfissional = lazy(() => import("../conta/AtividadeProfissional.jsx"));
const Cadastro = lazy(() => import("./Cadastro.jsx"));
const CampanhaPage = lazy(() => import("./CampanhaPage.jsx"));
const CampanhasEmpresa = lazy(() => import("./CampanhasEmpresa.jsx"));
const TreinamentoEmpresa = lazy(() => import("./TreinamentoEmpresa.jsx"));
const Carteira = lazy(() => import("./Carteira.jsx"));
const PerfilVendedor = lazy(() => import("./PerfilVendedor.jsx"));
const TestesAvaliacoes = lazy(() => import("./TestesAvaliacoes.jsx"));
const RycsClub = lazy(() => import("./RycsClub.jsx"));
const AcademyCatalogo = lazy(() => import("./AcademyCatalogo.jsx"));
const Academy = lazy(() => import("./Academy.jsx"));
const Indicacoes = lazy(() => import("../Indicacoes.jsx"));
const PlanosProfissional = lazy(() => import("./PlanosProfissional.jsx"));
const AgendaComercial = lazy(() => import("../agenda/AgendaComercial.jsx"));
const WhatsappVendedor = lazy(() => import("./WhatsappVendedor.jsx"));
const WhatsappPessoal = lazy(() => import("./WhatsappPessoal.jsx"));
const Conversas = lazy(() => import("./conversas/Conversas.jsx"));
const AreaColaborador = lazy(() => import("../colaborador/AreaColaborador.jsx"));
const LojaLeads = lazy(() => import("../empresa/LojaLeads.jsx"));

const ESPERA = <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

export default function Vendedor({ user, onLogout, db, setDb, up, aviso, aba, setAba, recarregar }) {
  const [abertaId, setAbertaId] = useState(null);
  const [campanhaAbertaId, setCampanhaAbertaId] = useState(null);
  const [academyFuncao, setAcademyFuncao] = useState(null);
  // Tour de aula interativa: o aluno saiu de uma aula para usar a ferramenta
  // real; guardamos curso + aula para ele voltar exatamente de onde parou.
  const [tour, setTour] = useState(null);
  const navegar = (destino, ctx) => { if (ctx) setTour(ctx); setAba(destino); };
  // Quando true, o profissional abriu a empresa mas ainda não está aprovado:
  // mostra TreinamentoEmpresa em vez de CampanhasEmpresa.
  const [modoTreinamento, setModoTreinamento] = useState(false);
  const eu = db.sellers.find((s) => s.id === db.sellerId);

  useEffect(() => {
    if (aba !== "oportunidades") { setAbertaId(null); setCampanhaAbertaId(null); }
  }, [aba]);
  // A área do colaborador interno não depende do perfil de profissional.
  if (aba === "agenda-comercial") return <Suspense fallback={ESPERA}><AgendaComercial /></Suspense>;
  if (aba === "colaborador") return <Suspense fallback={ESPERA}><AreaColaborador aviso={aviso} /></Suspense>;
  if (!eu) {
    if (db.sellers.length === 0)
      return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
    return <Suspense fallback={ESPERA}><Cadastro db={db} setDb={setDb} up={up} aviso={aviso} /></Suspense>;
  }

  // O quiz/triagem antigos deixaram de ser obrigatórios e não bloqueiam mais o
  // acesso: ao concluir o cadastro, o profissional entra direto na plataforma.
  // As avaliações (DISC, etc.) são voluntárias, pela página "Testes e Avaliações".

  const empresaAberta = db.companies.find((c) => c.id === abertaId);
  const campanhaAberta = db.campaigns?.find((c) => c.id === campanhaAbertaId);

  if (empresaAberta) {
    if (campanhaAberta) {
      return <Suspense fallback={ESPERA}><CampanhaPage campanha={campanhaAberta} empresa={empresaAberta} eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} voltar={() => setCampanhaAbertaId(null)} recarregar={recarregar} /></Suspense>;
    }
    // Profissional aprovado nesta empresa → vai direto para campanhas
    if (eu.aplicacoes?.[empresaAberta.id] === "aprovado" && !modoTreinamento) {
      return (
        <Suspense fallback={ESPERA}><CampanhasEmpresa
          empresa={empresaAberta}
          eu={eu}
          db={db}
          onAbrir={(id) => setCampanhaAbertaId(id)}
          voltar={() => setAbertaId(null)}
          aviso={aviso}
          recarregar={recarregar}
          irAcademy={(funcao) => { setAcademyFuncao(funcao); setAbertaId(null); setAba("academy"); }}
        /></Suspense>
      );
    }
    // Não aprovado ainda → treinamento + certificação
    return (
      <Suspense fallback={ESPERA}><TreinamentoEmpresa
        empresa={empresaAberta}
        eu={eu}
        voltar={() => { setAbertaId(null); setModoTreinamento(false); }}
        onAprovado={() => { setModoTreinamento(false); }}
        aviso={aviso}
        recarregar={recarregar}
      /></Suspense>
    );
  }

  return (
    <>
      <Suspense fallback={ESPERA}>
      {aba === "painel" && <PainelVendedor eu={eu} db={db} abrirEmpresas={() => setAba("oportunidades")} setAba={setAba} />}
      {aba === "oportunidades" && (
        <Oportunidades
          eu={eu}
          db={db}
          aviso={aviso}
          recarregar={recarregar}
          abrirCampanha={(c) => { setAbertaId(c.companyId); setCampanhaAbertaId(c.id); }}
        />
      )}
      {aba === "academy" && (academyFuncao
        ? <Academy eu={eu} aviso={aviso} funcaoInicial={academyFuncao} recarregar={recarregar}
            navegar={navegar} tour={tour} limparTour={() => setTour(null)} />
        : <AcademyCatalogo eu={eu} aviso={aviso}
            navegar={navegar} tour={tour} limparTour={() => setTour(null)} />)}
      {aba === "loja-leads" && <LojaLeads aviso={aviso} />}
      {aba === "whatsapp" && <WhatsappVendedor aviso={aviso} />}
      {aba === "whatsapp-pessoal" && <WhatsappPessoal aviso={aviso} />}
      {aba === "conversas-evolution" && <Conversas aviso={aviso} />}
      {aba === "carteira" && <Carteira eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} recarregar={recarregar} setAba={setAba} />}
      {aba === "indicar" && <Indicacoes aviso={aviso} />}
      {aba === "planos" && <PlanosProfissional aviso={aviso} />}
      {["conta", "configuracoes", "suporte-conta"].includes(aba) && <MinhaConta key={aba} secaoInicial={aba === "suporte-conta" ? "suporte" : aba === "configuracoes" ? "preferencias" : ""} user={user} entity={eu} db={db} up={up} setDb={setDb} aviso={aviso} recarregar={recarregar} onNavigate={setAba} onLogout={onLogout} />}
      {aba === "perfil" && <PerfilVendedor eu={eu} db={db} up={up} aviso={aviso} />}
      {aba === "testes" && <TestesAvaliacoes eu={eu} db={db} aviso={aviso} recarregar={recarregar} />}
      {aba === "club" && <RycsClub eu={eu} db={db} aviso={aviso} recarregar={recarregar} setAba={setAba} />}
      {["tarefas", "conversas"].includes(aba) && <AtividadeProfissional conversas={aba === "conversas"} eu={eu} db={db} up={up} aviso={aviso} recarregar={recarregar} />}
      </Suspense>

      {/* Tour de aula: enquanto o aluno explora a ferramenta real, um atalho
          sempre visível o traz de volta à aula de onde saiu. */}
      {tour && aba !== "academy" && (
        <button type="button" onClick={() => setAba("academy")}
          aria-label="Voltar ao curso"
          style={{
            position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 76, zIndex: 60,
            display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "10px 18px",
            borderRadius: 999, border: "1px solid var(--brand)", cursor: "pointer",
            background: "var(--brand)", color: "#fff", font: "inherit", fontSize: 13.5, fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,.28)",
          }}>
          <ArrowLeft size={15} /> Voltar ao curso
        </button>
      )}
    </>
  );
}
