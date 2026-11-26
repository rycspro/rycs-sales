// Segmentos e nichos para o onboarding (etapa 2).
// O front usa para os menus suspensos de seleção; o servidor valida.

export const SEGMENTOS = [
  {
    valor: "tecnologia",
    label: "Tecnologia",
    nichos: [
      "SaaS / Software como Serviço",
      "Desenvolvimento de Software",
      "Aplicativos Mobile",
      "Inteligência Artificial",
      "Automação e RPA",
      "Cibersegurança",
      "Cloud Computing",
      "E-commerce / Plataformas Digitais",
      "IoT / Internet das Coisas",
      "Infraestrutura de TI",
      "Data Analytics / BI",
      "Fintechs",
      "Edtechs",
      "Healthtechs",
      "Proptechs",
      "Lawtechs",
      "Agtechs",
      "Games e Entretenimento Digital",
      "Blockchain e Web3",
      "Hardware e Dispositivos",
    ],
  },
  {
    valor: "saude",
    label: "Saúde e Bem-estar",
    nichos: [
      "Clínicas Médicas",
      "Clínicas Odontológicas",
      "Clínicas de Estética",
      "Psicologia e Terapias",
      "Fisioterapia e Reabilitação",
      "Nutrição e Dietética",
      "Academias e Personal Trainers",
      "Farmácias e Drogarias",
      "Equipamentos Médicos",
      "Planos de Saúde",
      "Laboratórios e Diagnósticos",
      "Medicina do Trabalho",
      "Pilates e Yoga",
      "Produtos Naturais e Suplementos",
      "Home Care e Cuidadores",
      "Saúde Mental",
      "Veterinário / Pet Health",
    ],
  },
  {
    valor: "educacao",
    label: "Educação",
    nichos: [
      "Cursos Online / EAD",
      "Escolas de Idiomas",
      "Escolas Particulares",
      "Faculdades e Universidades",
      "Cursos Profissionalizantes",
      "Treinamentos Corporativos",
      "Coaching e Mentoria",
      "Concursos e Vestibulares",
      "Música e Artes",
      "Educação Infantil",
      "Reforço Escolar e Tutoria",
      "Plataformas de Ensino",
      "Certificações e Qualificações",
    ],
  },
  {
    valor: "financeiro",
    label: "Financeiro e Seguros",
    nichos: [
      "Contabilidade",
      "Consultoria Financeira",
      "Seguros de Vida e Saúde",
      "Seguros Patrimoniais",
      "Crédito e Financiamento",
      "Investimentos",
      "Consórcios",
      "Câmbio e Remessas",
      "Meios de Pagamento",
      "Auditoria e Compliance",
      "Planejamento Tributário",
      "Previdência Privada",
      "Factoring e Antecipação",
    ],
  },
  {
    valor: "imobiliario",
    label: "Imobiliário",
    nichos: [
      "Venda de Imóveis Residenciais",
      "Venda de Imóveis Comerciais",
      "Aluguel e Administração",
      "Construtoras e Incorporadoras",
      "Loteamentos",
      "Imóveis de Luxo",
      "Imóveis Rurais e Fazendas",
      "Coworking e Espaços Compartilhados",
      "Condomínios e Administradoras",
      "Avaliação e Perícia Imobiliária",
    ],
  },
  {
    valor: "varejo",
    label: "Varejo e Comércio",
    nichos: [
      "Moda e Vestuário",
      "Calçados e Acessórios",
      "Cosméticos e Perfumaria",
      "Joias e Bijuterias",
      "Eletrodomésticos e Eletrônicos",
      "Móveis e Decoração",
      "Papelaria e Presentes",
      "Brinquedos e Infantil",
      "Pet Shop e Produtos Pet",
      "Óticas e Relógios",
      "Artigos Esportivos",
      "Supermercados e Mercearias",
      "Lojas de Conveniência",
      "Sex Shop",
      "Floricultura",
      "E-commerce Geral",
    ],
  },
  {
    valor: "alimentacao",
    label: "Alimentação e Bebidas",
    nichos: [
      "Restaurantes",
      "Fast Food e Lanchonetes",
      "Cafeterias e Padarias",
      "Delivery e Dark Kitchens",
      "Confeitaria e Doces",
      "Alimentação Saudável e Fit",
      "Cervejarias e Destilarias",
      "Distribuidoras de Bebidas",
      "Buffet e Eventos",
      "Alimentos Orgânicos",
      "Marmitas e Refeições",
      "Food Trucks",
      "Indústria Alimentícia",
    ],
  },
  {
    valor: "servicos_profissionais",
    label: "Serviços Profissionais",
    nichos: [
      "Advocacia e Escritórios de Direito",
      "Consultoria Empresarial",
      "Recursos Humanos e Recrutamento",
      "Marketing e Publicidade",
      "Design e Branding",
      "Fotografia e Vídeo",
      "Traduções e Idiomas",
      "Assessoria de Imprensa",
      "Relações Públicas",
      "Pesquisa de Mercado",
      "Gestão de Projetos",
      "Terceirização / BPO",
    ],
  },
  {
    valor: "industria",
    label: "Indústria e Manufatura",
    nichos: [
      "Metalurgia e Siderurgia",
      "Plásticos e Embalagens",
      "Têxtil e Confecção",
      "Química e Farmacêutica",
      "Alimentos e Bebidas Industrial",
      "Máquinas e Equipamentos",
      "Automobilística e Autopeças",
      "Construção e Materiais",
      "Papel e Celulose",
      "Energia e Utilidades",
      "Mineração",
      "Eletroeletrônica",
    ],
  },
  {
    valor: "construcao",
    label: "Construção Civil",
    nichos: [
      "Empreiteiras e Obras",
      "Arquitetura e Projetos",
      "Engenharia Civil",
      "Reformas e Manutenção",
      "Materiais de Construção",
      "Pisos e Revestimentos",
      "Elétrica e Hidráulica",
      "Energia Solar e Sustentável",
      "Paisagismo e Jardinagem",
      "Esquadrias e Vidraçaria",
      "Impermeabilização",
      "Automação Residencial",
      "Estruturas Metálicas e Galpões",
    ],
  },
  {
    valor: "automotivo",
    label: "Automotivo",
    nichos: [
      "Concessionárias e Revendas",
      "Oficinas Mecânicas",
      "Funilaria e Pintura",
      "Acessórios e Customização",
      "Locação de Veículos",
      "Pneus e Borracharia",
      "Som e Película Automotiva",
      "Peças e Autopeças",
      "Motos e Motociclismo",
      "Caminhões e Veículos Pesados",
      "Lava Rápido e Estética Automotiva",
      "Seguros Automotivos",
    ],
  },
  {
    valor: "turismo",
    label: "Turismo e Hotelaria",
    nichos: [
      "Agências de Viagem",
      "Hotéis e Pousadas",
      "Turismo de Aventura e Ecoturismo",
      "Cruzeiros e Viagens Marítimas",
      "Turismo Corporativo e Eventos",
      "Intercâmbio e Turismo Estudantil",
      "Restaurantes Turísticos",
      "Guias e Passeios",
      "Aluguel de Temporada / Airbnb",
      "Parques e Atrações",
      "Turismo de Saúde e Bem-estar",
    ],
  },
  {
    valor: "beleza",
    label: "Beleza e Estética",
    nichos: [
      "Salões de Beleza e Cabeleireiros",
      "Barbearias",
      "Manicure e Pedicure",
      "Estética Facial e Corporal",
      "Depilação e Laser",
      "Micropigmentação",
      "Maquiagem Profissional",
      "Extensão de Cílios",
      "Design de Sobrancelhas",
      "Spa e Day Spa",
      "Cosméticos e Produtos de Beleza",
    ],
  },
  {
    valor: "logistica",
    label: "Logística e Transporte",
    nichos: [
      "Transportadoras",
      "Entregas e Courier",
      "Logística Reversa",
      "Armazenagem e Fulfillment",
      "Comércio Exterior e Importação",
      "Mudanças e Fretes",
      "Transporte de Passageiros",
      "Despachantes",
      "Supply Chain e Gestão de Estoque",
    ],
  },
  {
    valor: "agronegocio",
    label: "Agronegócio",
    nichos: [
      "Insumos Agrícolas",
      "Máquinas Agrícolas",
      "Pecuária",
      "Consultoria Agro",
      "Irrigação e Tecnologia Agro",
      "Grãos e Commodities",
      "Orgânicos e Sustentabilidade",
      "Floricultura e Paisagismo",
      "Piscicultura e Aquicultura",
      "Cooperativas Agrícolas",
    ],
  },
  {
    valor: "eventos",
    label: "Eventos e Entretenimento",
    nichos: [
      "Produção de Eventos",
      "Casamentos e Festas",
      "Eventos Corporativos",
      "Shows e Espetáculos",
      "Decoração e Cenografia",
      "Espaços para Eventos",
      "Som e Iluminação",
      "DJs e Bandas",
      "Fotografia e Filmagem de Eventos",
      "Brinquedos e Recreação",
    ],
  },
  {
    valor: "energia",
    label: "Energia",
    nichos: [
      "Energia Solar Fotovoltaica",
      "Energia Eólica",
      "Eficiência Energética",
      "Distribuidoras de Energia",
      "Geradores e Nobreaks",
      "Consultoria em Energia",
      "Biomassa e Biogás",
      "GLP e Gás Natural",
    ],
  },
  {
    valor: "esportes",
    label: "Esportes e Lazer",
    nichos: [
      "Academias e Crossfit",
      "Artes Marciais e Lutas",
      "Natação e Esportes Aquáticos",
      "Futebol e Esportes Coletivos",
      "Corrida e Ciclismo",
      "Golf e Tênis",
      "Equipamentos Esportivos",
      "Suplementos Esportivos",
      "Camping e Outdoor",
    ],
  },
  {
    valor: "social",
    label: "Terceiro Setor / Social",
    nichos: [
      "ONGs e Associações",
      "Captação de Recursos / Fundraising",
      "Projetos Sociais",
      "Inclusão e Acessibilidade",
      "Voluntariado",
    ],
  },
  {
    valor: "outro",
    label: "Outro",
    nichos: [],
  },
];

export const SEGMENTOS_FLAT = SEGMENTOS.map(({ valor, label }) => ({ valor, label }));

export function nichosPorSegmento(segmento) {
  const seg = SEGMENTOS.find((s) => s.valor === segmento);
  return seg ? seg.nichos : [];
}

// ─── Segmento automático ─────────────────────────────────────────────────────
// Empresas que não escolheram segmento aparecem para o profissional como
// "Segmento não informado". Aqui o segmento é deduzido do que a própria
// empresa escreveu (nome, razão social, produto, descrição, CNAEs), por
// palavras-chave, sempre apontando para o catálogo acima. Sem palavra-chave
// reconhecida, devolve null: nunca chuta um segmento.
//
// Termos sem acento e em minúsculas. Por padrão o termo casa palavra inteira;
// com "*" no fim, casa o começo da palavra ("contab*" → contabilidade).
// Termo com mais de uma palavra vale 2 pontos; palavra solta vale 1. Regras
// genéricas (sem nicho) valem metade, para o nicho específico ganhar.
const REGRAS_SEGMENTO = [
  // Energia
  { segmento: "energia", nicho: "Energia Solar Fotovoltaica", termos: ["energia solar", "solar", "fotovolt*", "painel solar", "paineis solares", "placas solares", "usina solar", "geracao distribuida"] },
  { segmento: "energia", nicho: "Eficiência Energética", termos: ["eficiencia energetica", "energia eletrica", "comercializacao de energia", "comercializadora de energia", "mercado livre de energia", "gestao de energia"] },
  { segmento: "energia", nicho: "Geradores e Nobreaks", termos: ["gerador*", "nobreak*"] },
  { segmento: "energia", nicho: "GLP e Gás Natural", termos: ["glp", "gas natural", "gas de cozinha"] },
  { segmento: "energia", nicho: "", termos: ["energia", "energetica"] },

  // Saúde
  { segmento: "saude", nicho: "Planos de Saúde", termos: ["plano de saude", "planos de saude", "plano odontologico", "planos odontologicos", "operadora de saude", "convenio medico", "convenios medicos", "saude e seguros", "corretora de saude", "unimed", "hapvida", "amil", "sulamerica", "bradesco saude"] },
  { segmento: "saude", nicho: "Farmácias e Drogarias", termos: ["farmacia*", "drogaria*", "medicamento*", "manipulacao", "dermocosmetic*"] },
  { segmento: "saude", nicho: "Equipamentos Médicos", termos: ["equipamentos medicos", "produtos medicos", "material hospitalar", "materiais hospitalares", "insumos hospitalares", "hospitalar*"] },
  { segmento: "saude", nicho: "Clínicas Odontológicas", termos: ["odonto*", "dentist*", "dental", "implante dentario"] },
  { segmento: "saude", nicho: "Clínicas de Estética", termos: ["clinica de estetica", "clinicas de estetica", "harmonizacao facial", "estetica avancada"] },
  { segmento: "saude", nicho: "Clínicas Médicas", termos: ["clinica medica", "clinicas medicas", "clinica", "clinicas", "consultorio*", "medico", "medicos", "hospital", "hospitais"] },
  { segmento: "saude", nicho: "Psicologia e Terapias", termos: ["psicolog*", "terapia*", "terapeut*", "psicanalis*"] },
  { segmento: "saude", nicho: "Fisioterapia e Reabilitação", termos: ["fisioterap*", "reabilitacao"] },
  { segmento: "saude", nicho: "Nutrição e Dietética", termos: ["nutricionista*", "nutricao"] },
  { segmento: "saude", nicho: "Laboratórios e Diagnósticos", termos: ["laboratorio*", "exames", "diagnostico por imagem"] },
  { segmento: "saude", nicho: "Medicina do Trabalho", termos: ["medicina do trabalho", "saude ocupacional", "seguranca do trabalho"] },
  { segmento: "saude", nicho: "Produtos Naturais e Suplementos", termos: ["suplemento*", "produtos naturais", "fitoterap*"] },
  { segmento: "saude", nicho: "Saúde Mental", termos: ["saude mental"] },
  { segmento: "saude", nicho: "Home Care e Cuidadores", termos: ["home care", "cuidador*"] },
  { segmento: "saude", nicho: "Veterinário / Pet Health", termos: ["veterinar*"] },
  { segmento: "saude", nicho: "", termos: ["saude", "bem estar"] },

  // Financeiro e seguros
  { segmento: "financeiro", nicho: "Seguros de Vida e Saúde", termos: ["seguro de vida", "seguros de vida", "corretora de seguros", "corretor de seguros", "corretora", "corretor", "seguro", "seguros"] },
  { segmento: "financeiro", nicho: "Contabilidade", termos: ["contab*", "contador*", "escritorio contabil"] },
  { segmento: "financeiro", nicho: "Consórcios", termos: ["consorcio*"] },
  { segmento: "financeiro", nicho: "Crédito e Financiamento", termos: ["credito", "financiamento*", "emprestimo*", "home equity"] },
  { segmento: "financeiro", nicho: "Investimentos", termos: ["investimento*", "assessoria de investimentos"] },
  { segmento: "financeiro", nicho: "Meios de Pagamento", termos: ["maquininha*", "meios de pagamento", "gateway de pagamento"] },
  { segmento: "financeiro", nicho: "Consultoria Financeira", termos: ["consultoria financeira", "bpo financeiro", "planejamento financeiro", "gestao financeira"] },
  { segmento: "financeiro", nicho: "Planejamento Tributário", termos: ["planejamento tributario", "recuperacao tributaria", "recuperacao de creditos"] },
  { segmento: "financeiro", nicho: "Câmbio e Remessas", termos: ["cambio", "remessa*"] },
  { segmento: "financeiro", nicho: "Previdência Privada", termos: ["previdencia privada"] },

  // Serviços profissionais
  { segmento: "servicos_profissionais", nicho: "Marketing e Publicidade", termos: ["marketing", "agencia", "agencia de marketing", "marketing digital", "publicidade", "propaganda", "trafego pago", "gestao de trafego", "social media", "midias sociais", "redes sociais"] },
  { segmento: "servicos_profissionais", nicho: "Consultoria Empresarial", termos: ["consultoria", "assessoria", "assessoria de vendas", "consultoria empresarial", "times comerciais", "time comercial", "gestao comercial", "processo comercial", "inteligencia comercial"] },
  { segmento: "servicos_profissionais", nicho: "Advocacia e Escritórios de Direito", termos: ["advocacia", "advogad*", "juridic*", "escritorio de direito"] },
  { segmento: "servicos_profissionais", nicho: "Recursos Humanos e Recrutamento", termos: ["recrutamento", "recursos humanos", "headhunter*", "selecao de pessoas"] },
  { segmento: "servicos_profissionais", nicho: "Design e Branding", termos: ["design", "branding", "identidade visual"] },
  { segmento: "servicos_profissionais", nicho: "Fotografia e Vídeo", termos: ["fotografia", "fotografo*", "audiovisual", "produtora de video"] },
  { segmento: "servicos_profissionais", nicho: "Traduções e Idiomas", termos: ["traducao", "traducoes", "tradutor*"] },
  { segmento: "servicos_profissionais", nicho: "Assessoria de Imprensa", termos: ["assessoria de imprensa"] },
  { segmento: "servicos_profissionais", nicho: "Pesquisa de Mercado", termos: ["pesquisa de mercado"] },
  { segmento: "servicos_profissionais", nicho: "Terceirização / BPO", termos: ["terceirizacao", "bpo", "outsourcing", "call center", "telemarketing"] },

  // Tecnologia
  { segmento: "tecnologia", nicho: "Inteligência Artificial", termos: ["inteligencia artificial", "chatbot*", "agentes de ia"] },
  { segmento: "tecnologia", nicho: "Desenvolvimento de Software", termos: ["desenvolvimento de software", "desenvolvimento de sistemas", "fabrica de software", "criacao de sites", "desenvolvimento web"] },
  { segmento: "tecnologia", nicho: "Aplicativos Mobile", termos: ["aplicativo*", "app mobile"] },
  { segmento: "tecnologia", nicho: "Cibersegurança", termos: ["ciberseguranca", "seguranca da informacao"] },
  { segmento: "tecnologia", nicho: "Infraestrutura de TI", termos: ["infraestrutura de ti", "suporte de ti", "informatica"] },
  { segmento: "tecnologia", nicho: "Fintechs", termos: ["fintech*"] },
  { segmento: "tecnologia", nicho: "SaaS / Software como Serviço", termos: ["saas", "software*", "crm", "erp", "sistema de gestao", "plataforma"] },
  { segmento: "tecnologia", nicho: "", termos: ["tecnologia", "ti"] },

  // Educação
  { segmento: "educacao", nicho: "Cursos Online / EAD", termos: ["curso online", "cursos online", "ead", "infoproduto*", "escola online"] },
  { segmento: "educacao", nicho: "Treinamentos Corporativos", termos: ["treinamento*", "capacitacao", "palestra*"] },
  { segmento: "educacao", nicho: "Coaching e Mentoria", termos: ["coach*", "mentoria*"] },
  { segmento: "educacao", nicho: "Escolas de Idiomas", termos: ["escola de idiomas", "idioma*", "ingles"] },
  { segmento: "educacao", nicho: "Faculdades e Universidades", termos: ["faculdade*", "universidade*", "pos graduacao", "mba"] },
  { segmento: "educacao", nicho: "Escolas Particulares", termos: ["escola", "escolas", "colegio*"] },
  { segmento: "educacao", nicho: "Concursos e Vestibulares", termos: ["concurso*", "vestibular*"] },
  { segmento: "educacao", nicho: "", termos: ["curso", "cursos", "educacao", "ensino", "instituto"] },

  // Imobiliário
  { segmento: "imobiliario", nicho: "Construtoras e Incorporadoras", termos: ["construtora*", "incorporadora*", "incorporacao"] },
  { segmento: "imobiliario", nicho: "Loteamentos", termos: ["loteamento*", "lotes"] },
  { segmento: "imobiliario", nicho: "Aluguel e Administração", termos: ["administracao de imoveis", "locacao de imoveis", "aluguel de imoveis"] },
  { segmento: "imobiliario", nicho: "Condomínios e Administradoras", termos: ["condominio*", "administradora de condominios"] },
  { segmento: "imobiliario", nicho: "", termos: ["imobiliaria*", "imoveis", "imovel", "corretora de imoveis", "corretor de imoveis", "empreendimento*"] },

  // Construção civil
  { segmento: "construcao", nicho: "Estruturas Metálicas e Galpões", termos: ["estrutura metalica", "estruturas metalicas", "galp*", "pre moldado*", "steel frame", "modulares"] },
  { segmento: "construcao", nicho: "Arquitetura e Projetos", termos: ["arquitet*"] },
  { segmento: "construcao", nicho: "Engenharia Civil", termos: ["engenharia civil", "engenharia"] },
  { segmento: "construcao", nicho: "Reformas e Manutenção", termos: ["reforma*", "manutencao predial"] },
  { segmento: "construcao", nicho: "Materiais de Construção", termos: ["materiais de construcao", "material de construcao"] },
  { segmento: "construcao", nicho: "Pisos e Revestimentos", termos: ["piso*", "revestimento*", "porcelanato*"] },
  { segmento: "construcao", nicho: "Elétrica e Hidráulica", termos: ["eletrica e hidraulica", "instalacoes eletricas", "eletricista*", "hidraulica"] },
  { segmento: "construcao", nicho: "Esquadrias e Vidraçaria", termos: ["esquadria*", "vidracaria*", "vidros"] },
  { segmento: "construcao", nicho: "Impermeabilização", termos: ["impermeabiliza*"] },
  { segmento: "construcao", nicho: "Automação Residencial", termos: ["automacao residencial", "casa inteligente"] },
  { segmento: "construcao", nicho: "Paisagismo e Jardinagem", termos: ["paisagismo", "jardinagem"] },
  { segmento: "construcao", nicho: "", termos: ["construcao", "construcao civil", "obras", "empreiteira*"] },

  // Indústria
  { segmento: "industria", nicho: "Metalurgia e Siderurgia", termos: ["metalurg*", "siderurg*", "usinagem", "caldeiraria"] },
  { segmento: "industria", nicho: "Plásticos e Embalagens", termos: ["embalage*", "plastico*"] },
  { segmento: "industria", nicho: "Têxtil e Confecção", termos: ["textil", "confeccao", "confeccoes"] },
  { segmento: "industria", nicho: "Máquinas e Equipamentos", termos: ["maquinas e equipamentos", "maquinas industriais"] },
  { segmento: "industria", nicho: "Química e Farmacêutica", termos: ["quimica", "quimicos", "industria farmaceutica"] },
  { segmento: "industria", nicho: "", termos: ["industria*", "fabrica", "fabricante*", "manufatura"] },

  // Varejo
  { segmento: "varejo", nicho: "E-commerce Geral", termos: ["e commerce", "ecommerce", "loja virtual", "loja online"] },
  { segmento: "varejo", nicho: "Moda e Vestuário", termos: ["moda", "roupa*", "vestuario", "boutique"] },
  { segmento: "varejo", nicho: "Calçados e Acessórios", termos: ["calcado*", "sapato*", "bolsas"] },
  { segmento: "varejo", nicho: "Cosméticos e Perfumaria", termos: ["cosmetic*", "perfum*", "maquiagem"] },
  { segmento: "varejo", nicho: "Joias e Bijuterias", termos: ["joia*", "semijoia*", "bijuteria*"] },
  { segmento: "varejo", nicho: "Eletrodomésticos e Eletrônicos", termos: ["eletronico*", "eletrodomestic*", "celular*", "smartphone*"] },
  { segmento: "varejo", nicho: "Móveis e Decoração", termos: ["movei*", "decoracao", "planejados"] },
  { segmento: "varejo", nicho: "Pet Shop e Produtos Pet", termos: ["pet shop", "petshop", "racao", "racoes"] },
  { segmento: "varejo", nicho: "Óticas e Relógios", termos: ["otica*", "relogio*"] },
  { segmento: "varejo", nicho: "Supermercados e Mercearias", termos: ["supermercado*", "mercearia*", "atacarejo"] },
  { segmento: "varejo", nicho: "Papelaria e Presentes", termos: ["papelaria*", "presentes"] },
  { segmento: "varejo", nicho: "Brinquedos e Infantil", termos: ["brinquedo*"] },
  { segmento: "varejo", nicho: "Floricultura", termos: ["floricultura*"] },
  { segmento: "varejo", nicho: "", termos: ["store", "loja", "lojas", "varejo", "varejista", "comercio"] },

  // Alimentação
  { segmento: "alimentacao", nicho: "Restaurantes", termos: ["restaurante*"] },
  { segmento: "alimentacao", nicho: "Fast Food e Lanchonetes", termos: ["lanchonete*", "hamburgueria*", "pizzaria*", "fast food"] },
  { segmento: "alimentacao", nicho: "Cafeterias e Padarias", termos: ["cafeteria*", "padaria*"] },
  { segmento: "alimentacao", nicho: "Delivery e Dark Kitchens", termos: ["delivery", "dark kitchen"] },
  { segmento: "alimentacao", nicho: "Confeitaria e Doces", termos: ["confeitaria*", "doceria*", "chocolate*"] },
  { segmento: "alimentacao", nicho: "Cervejarias e Destilarias", termos: ["cervejaria*", "destilaria*", "cerveja*"] },
  { segmento: "alimentacao", nicho: "Distribuidoras de Bebidas", termos: ["distribuidora de bebidas", "bebidas"] },
  { segmento: "alimentacao", nicho: "Buffet e Eventos", termos: ["buffet*"] },
  { segmento: "alimentacao", nicho: "Marmitas e Refeições", termos: ["marmita*"] },
  { segmento: "alimentacao", nicho: "", termos: ["alimento*", "alimenticio*", "alimentacao", "gastronomia"] },

  // Beleza
  { segmento: "beleza", nicho: "Salões de Beleza e Cabeleireiros", termos: ["salao de beleza", "cabeleireir*", "cabelo*"] },
  { segmento: "beleza", nicho: "Barbearias", termos: ["barbearia*"] },
  { segmento: "beleza", nicho: "Estética Facial e Corporal", termos: ["estetica*"] },
  { segmento: "beleza", nicho: "Depilação e Laser", termos: ["depilacao"] },
  { segmento: "beleza", nicho: "Micropigmentação", termos: ["micropigmentacao"] },
  { segmento: "beleza", nicho: "", termos: ["beleza"] },

  // Automotivo
  { segmento: "automotivo", nicho: "Concessionárias e Revendas", termos: ["concessionaria*", "revenda de veiculos", "seminovos"] },
  { segmento: "automotivo", nicho: "Oficinas Mecânicas", termos: ["oficina*", "mecanica automotiva"] },
  { segmento: "automotivo", nicho: "Locação de Veículos", termos: ["locadora de veiculos", "locacao de veiculos", "aluguel de carros"] },
  { segmento: "automotivo", nicho: "Pneus e Borracharia", termos: ["pneu*", "borracharia*"] },
  { segmento: "automotivo", nicho: "Peças e Autopeças", termos: ["autope*", "pecas automotivas"] },
  { segmento: "automotivo", nicho: "Lava Rápido e Estética Automotiva", termos: ["lava rapido", "lava jato", "estetica automotiva"] },
  { segmento: "automotivo", nicho: "Seguros Automotivos", termos: ["seguro auto", "seguro automotivo", "protecao veicular"] },
  { segmento: "automotivo", nicho: "", termos: ["automotiv*", "veiculo*", "carros", "motos"] },

  // Turismo
  { segmento: "turismo", nicho: "Agências de Viagem", termos: ["agencia de viagem", "agencia de viagens", "viage*", "turismo"] },
  { segmento: "turismo", nicho: "Hotéis e Pousadas", termos: ["hotel", "hoteis", "pousada*", "hostel"] },
  { segmento: "turismo", nicho: "Intercâmbio e Turismo Estudantil", termos: ["intercambio*"] },

  // Logística
  { segmento: "logistica", nicho: "Transportadoras", termos: ["transportadora*", "transporte de cargas", "frete*"] },
  { segmento: "logistica", nicho: "Entregas e Courier", termos: ["entregas", "courier", "motoboy*"] },
  { segmento: "logistica", nicho: "Armazenagem e Fulfillment", termos: ["armazenagem", "fulfillment"] },
  { segmento: "logistica", nicho: "Comércio Exterior e Importação", termos: ["comercio exterior", "importacao", "exportacao", "importadora*", "exportadora*"] },
  { segmento: "logistica", nicho: "Despachantes", termos: ["despachante*"] },
  { segmento: "logistica", nicho: "", termos: ["logistica", "transporte*"] },

  // Agronegócio
  { segmento: "agronegocio", nicho: "Insumos Agrícolas", termos: ["insumos agricolas", "fertilizante*", "defensivo*", "sementes"] },
  { segmento: "agronegocio", nicho: "Máquinas Agrícolas", termos: ["maquinas agricolas", "trator*"] },
  { segmento: "agronegocio", nicho: "Pecuária", termos: ["pecuaria", "gado", "bovino*"] },
  { segmento: "agronegocio", nicho: "Irrigação e Tecnologia Agro", termos: ["irrigacao"] },
  { segmento: "agronegocio", nicho: "", termos: ["agro", "agronegocio", "agropecuaria", "agricola*", "agricultura", "rural"] },

  // Eventos
  { segmento: "eventos", nicho: "Produção de Eventos", termos: ["producao de eventos", "organizacao de eventos"] },
  { segmento: "eventos", nicho: "Casamentos e Festas", termos: ["casamento*", "festas"] },
  { segmento: "eventos", nicho: "Espaços para Eventos", termos: ["espaco para eventos", "espaco de eventos", "salao de festas"] },
  { segmento: "eventos", nicho: "", termos: ["eventos", "entretenimento"] },

  // Esportes
  { segmento: "esportes", nicho: "Academias e Crossfit", termos: ["academia*", "crossfit", "personal trainer"] },
  { segmento: "esportes", nicho: "Artes Marciais e Lutas", termos: ["artes marciais", "jiu jitsu", "muay thai", "lutas"] },
  { segmento: "esportes", nicho: "Corrida e Ciclismo", termos: ["ciclismo", "bicicleta*", "corrida"] },
  { segmento: "esportes", nicho: "", termos: ["esporte*", "esportivo*", "performance esportiva"] },

  // Terceiro setor
  { segmento: "social", nicho: "ONGs e Associações", termos: ["ong", "ongs", "terceiro setor", "projeto social", "projetos sociais", "sem fins lucrativos"] },
];

const SEGMENTO_LABEL = Object.fromEntries(SEGMENTOS.map((s) => [s.valor, s.label]));

const normalizarTexto = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const REGRAS_COMPILADAS = REGRAS_SEGMENTO.map((r) => ({
  ...r,
  peso: r.nicho ? 1 : 0.5,
  termos: r.termos.map((t) => {
    const prefixo = t.endsWith("*");
    const base = normalizarTexto(prefixo ? t.slice(0, -1) : t);
    return {
      re: new RegExp(`(?:^| )${escaparRegex(base)}${prefixo ? "" : "(?= |$)"}`),
      pontos: base.includes(" ") ? 2 : 1,
    };
  }),
}));

// Texto da empresa que serve de pista. O ICP fica de fora: descreve o cliente
// dela, não ela (um CRM para clínicas não é uma clínica).
function textoDaEmpresa(empresa) {
  const e = empresa || {};
  let cnaes = e.cnaes;
  if (cnaes && typeof cnaes !== "string") { try { cnaes = JSON.stringify(cnaes); } catch { cnaes = ""; } }
  return normalizarTexto([e.nome, e.razaoSocial, e.produto, e.descricaoInstitucional, cnaes].filter(Boolean).join(" "));
}

// { segmento, nicho } do catálogo, ou null quando nada no texto indica o ramo.
export function inferirSegmentoEmpresa(empresa) {
  const texto = textoDaEmpresa(empresa);
  if (!texto) return null;
  let melhor = null;
  for (const regra of REGRAS_COMPILADAS) {
    let pontos = 0;
    for (const t of regra.termos) if (t.re.test(texto)) pontos += t.pontos;
    pontos *= regra.peso;
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { segmento: regra.segmento, nicho: regra.nicho, pontos };
  }
  return melhor ? { segmento: melhor.segmento, nicho: melhor.nicho } : null;
}

export const rotuloDoSegmento = (valor) => SEGMENTO_LABEL[valor] || valor || "";

// Rótulo exibido para a empresa: o nicho (mais específico) quando existe;
// senão o segmento; senão o deduzido do texto. "" quando não há pista nenhuma.
export function rotuloSegmentoEmpresa(empresa) {
  if (!empresa) return "";
  const nicho = String(empresa.nicho || "").trim();
  if (nicho) return nicho;
  const segmento = String(empresa.segmento || "").trim();
  if (segmento) return rotuloDoSegmento(segmento);
  const inferido = inferirSegmentoEmpresa(empresa);
  return inferido ? (inferido.nicho || rotuloDoSegmento(inferido.segmento)) : "";
}
