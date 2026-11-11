import MinhaConta from "../conta/MinhaConta.jsx";
import AtividadeProfissional from "../conta/AtividadeProfissional.jsx";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useI18n } from "../../lib/i18n.jsx";
import Cadastro from "./Cadastro.jsx";
import PainelVendedor from "./PainelVendedor.jsx";
import Oportunidades from "./Oportunidades.jsx";
import Workspace from "./Workspace.jsx";
import CampanhaPage from "./CampanhaPage.jsx";
import CampanhasEmpresa from "./CampanhasEmpresa.jsx";
import TreinamentoEmpresa from "./TreinamentoEmpresa.jsx";
import Carteira from "./Carteira.jsx";
import PerfilVendedor from "./PerfilVendedor.jsx";
import AcademyCatalogo from "./AcademyCatalogo.jsx";
import Academy from "./Academy.jsx";
import Indicacoes from "../Indicacoes.jsx";
import Triagem from "./Triagem.jsx";
import OnboardingProfissional from "./OnboardingProfissional.jsx";

export default function Vendedor({ user, onLogout, db, setDb, up, aviso, aba, setAba, recarregar }) {
  const { t } = useI18n();
  const [abertaId, setAbertaId] = useState(null);
  const [campanhaAbertaId, setCampanhaAbertaId] = useState(null);
  const [academyFuncao, setAcademyFuncao] = useState(null);
  // Tour de aula interativa: o aluno saiu de uma aula para usar a ferramenta
  // real; guardamos curso + aula para ele voltar exatamente de onde parou.
  const [tour, setTour] = useState(null);
  const navegar = (destino, ctx) => { if (ctx) setTour(ctx); setAba(destino); };
  const [refazendo, setRefazendo] = useState(false);
  // Quando true, o profissional abriu a empresa mas ainda não está aprovado:
  // mostra TreinamentoEmpresa em vez de CampanhasEmpresa.
  const [modoTreinamento, setModoTreinamento] = useState(false);
  const eu = db.sellers.find((s) => s.id === db.sellerId);

  useEffect(() => {
    if (aba !== "oportunidades") { setAbertaId(null); setCampanhaAbertaId(null); }
  }, [aba]);
  if (!eu) {
    if (db.sellers.length === 0)
      return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
    return <Cadastro db={db} setDb={setDb} up={up} aviso={aviso} />;
  }

  const emOnboarding = eu.onboardingEtapa && eu.onboardingEtapa !== "concluido";
  if (emOnboarding && !refazendo && !["conta", "configuracoes", "suporte-conta"].includes(aba))
    return (
      <OnboardingProfissional
        aviso={aviso}
        recarregar={recarregar}
        aoConcluir={() => recarregar()}
      />
    );

  const precisaAvaliar = eu.status === "triagem" || eu.status === "recusado";
  if ((precisaAvaliar || refazendo) && !["conta", "configuracoes", "suporte-conta"].includes(aba))
    return (
      <Triagem
        aviso={aviso}
        recarregar={recarregar}
        irAcademy={() => { setRefazendo(false); setAba("academy"); }}
        voltar={refazendo ? () => setRefazendo(false) : null}
      />
    );

  const empresaAberta = db.companies.find((c) => c.id === abertaId);
  const campanhaAberta = db.campaigns?.find((c) => c.id === campanhaAbertaId);

  if (empresaAberta) {
    if (campanhaAberta) {
      return <CampanhaPage campanha={campanhaAberta} empresa={empresaAberta} eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} voltar={() => setCampanhaAbertaId(null)} recarregar={recarregar} />;
    }
    // Profissional aprovado nesta empresa → vai direto para campanhas
    if (eu.aplicacoes?.[empresaAberta.id] === "aprovado" && !modoTreinamento) {
      return (
        <CampanhasEmpresa
          empresa={empresaAberta}
          eu={eu}
          db={db}
          onAbrir={(id) => setCampanhaAbertaId(id)}
          voltar={() => setAbertaId(null)}
          aviso={aviso}
          recarregar={recarregar}
          irAcademy={(funcao) => { setAcademyFuncao(funcao); setAbertaId(null); setAba("academy"); }}
        />
      );
    }
    // Não aprovado ainda → treinamento + certificação
    return (
      <TreinamentoEmpresa
        empresa={empresaAberta}
        eu={eu}
        voltar={() => { setAbertaId(null); setModoTreinamento(false); }}
        onAprovado={() => { setModoTreinamento(false); }}
        aviso={aviso}
        recarregar={recarregar}
      />
    );
  }

  return (
    <>
      {aba === "painel" && <PainelVendedor eu={eu} db={db} abrirEmpresas={() => setAba("oportunidades")} />}
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
      {aba === "carteira" && <Carteira eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} recarregar={recarregar} />}
      {aba === "indicar" && <Indicacoes aviso={aviso} />}
      {["conta", "configuracoes", "suporte-conta"].includes(aba) && <MinhaConta key={aba} secaoInicial={aba === "suporte-conta" ? "suporte" : aba === "configuracoes" ? "preferencias" : ""} user={user} entity={eu} db={db} up={up} setDb={setDb} aviso={aviso} recarregar={recarregar} onNavigate={setAba} onLogout={onLogout} refazerAvaliacao={() => setRefazendo(true)} />}
      {aba === "perfil" && <PerfilVendedor eu={eu} db={db} up={up} aviso={aviso} refazerAvaliacao={() => setRefazendo(true)} />}
      {["tarefas", "conversas"].includes(aba) && <AtividadeProfissional conversas={aba === "conversas"} eu={eu} db={db} up={up} aviso={aviso} recarregar={recarregar} />}

      {/* Tour de aula: enquanto o aluno explora a ferramenta real, um atalho
          sempre visível o traz de volta à aula de onde saiu. */}
      {tour && aba !== "academy" && (
        <button type="button" onClick={() => setAba("academy")}
          aria-label={t("seller.backToCourse")}
          style={{
            position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 76, zIndex: 60,
            display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "10px 18px",
            borderRadius: 999, border: "1px solid var(--brand)", cursor: "pointer",
            background: "var(--brand)", color: "#fff", font: "inherit", fontSize: 13.5, fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,.28)",
          }}>
          <ArrowLeft size={15} /> {t("seller.backToCourse")}
        </button>
      )}
    </>
  );
}
