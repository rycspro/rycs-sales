import { useI18n } from "../../lib/i18n.jsx";

export default function Termos({ onAceitar, onVoltar, somenteLeitura }) {
  const { t } = useI18n();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: 640 }}>
        <div className="vx-card" style={{ padding: 24, maxHeight: "80vh", overflowY: "auto" }}>
          <div className="vx-disp" style={{ fontSize: 20, marginBottom: 16 }}>Termos de Uso — RYCS Sales Machine</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)" }}>
            <p><b>1. Objeto.</b> A RYCS Sales Machine é uma plataforma digital que conecta empresas contratantes a profissionais de vendas independentes, intermediando atividades comerciais verificadas por inteligência artificial.</p>
            <p><b>2. Cadastro.</b> O usuário declara que as informações fornecidas são verdadeiras. A RYCS reserva-se o direito de recusar ou suspender cadastros com informações falsas.</p>
            <p><b>3. Papel da RYCS.</b> A RYCS atua como intermediadora. Não há vínculo empregatício entre a RYCS e os profissionais, nem entre as empresas e os profissionais. A remuneração é por ação verificada.</p>
            <p><b>4. Comissões e pagamentos.</b> As comissões são definidas por cada empresa em suas campanhas. A RYCS cobra uma taxa de serviço (taxa por movimentações) sobre o volume transacionado. Os pagamentos aos profissionais são processados via Pix após liberação pela plataforma.</p>
            <p><b>5. Auditoria.</b> Todas as ações são verificadas por inteligência artificial e/ou revisão humana. Ações fraudulentas resultam em suspensão imediata e retenção de valores.</p>
            <p><b>6. Saldo e saques.</b> Empresas adicionam saldo à plataforma para remunerar ações. Profissionais podem sacar valores liberados a qualquer momento, sujeito ao valor mínimo de R$ 10,00.</p>
            <p><b>7. Privacidade e LGPD.</b> Os dados pessoais são tratados conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Os dados são usados exclusivamente para operação da plataforma e podem ser excluídos mediante solicitação do titular.</p>
            <p><b>8. Propriedade intelectual.</b> Todo o conteúdo da plataforma, incluindo treinamentos e materiais, pertence à RYCS ou às empresas contratantes.</p>
            <p><b>9. Rescisão.</b> O usuário pode encerrar sua conta a qualquer momento. Valores pendentes serão liquidados conforme os prazos operacionais.</p>
            <p><b>10. Foro.</b> Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.</p>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div className="vx-disp" style={{ fontSize: 18, marginBottom: 12 }}>Política de Privacidade</div>
              <p><b>Dados coletados:</b> nome, e-mail, telefone, cidade, chave Pix, vídeos e áudios de comprovação.</p>
              <p><b>Finalidade:</b> operação da plataforma, verificação de ações, processamento de pagamentos e comunicação com o usuário.</p>
              <p><b>Compartilhamento:</b> dados são compartilhados apenas entre as partes envolvidas na operação (empresa ↔ RYCS ↔ profissional) e com processadores de pagamento.</p>
              <p><b>Retenção:</b> dados são mantidos enquanto a conta estiver ativa e por 5 anos após o encerramento, conforme obrigações legais.</p>
              <p><b>Direitos do titular:</b> acesso, correção, exclusão, portabilidade e revogação do consentimento podem ser solicitados via e-mail: contato@rycs.com.br.</p>
              <p><b>Segurança:</b> utilizamos criptografia, tokens seguros e cookies HttpOnly para proteger seus dados.</p>
            </div>
          </div>
          {!somenteLeitura && <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 20 }} onClick={onAceitar}>
            {t("auth.terms.accept")}
          </button>}
          <button className="vx-btn vx-btn-ghost vx-btn-block vx-btn-sm" style={{ marginTop: 6 }} onClick={onVoltar}>{t("app.back")}</button>
        </div>
      </div>
    </div>
  );
}
