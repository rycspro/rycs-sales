// Validação de foto de perfil.
//
// Avalia APRESENTAÇÃO, nunca a pessoa. Não há, e não deve haver, critério de
// beleza, raça, idade, gênero, corpo ou qualquer característica pessoal. O que
// entra na nota é o que qualquer fotógrafo diria sobre um arquivo: resolução,
// enquadramento, nitidez, peso e formato.
//
// As checagens técnicas rodam sem IA nenhuma e são determinísticas. As de
// conteúdo — rosto visível, meme, logotipo, captura de tela — dependem do
// VisionProvider do Audit Engine e ficam PENDENTES enquanto não houver
// provedor configurado. Pendente não reprova e não inventa nota.

export const LIMITES = {
  tamanhoMaximoBytes: 2 * 1024 * 1024,
  larguraMinima: 300,
  alturaMinima: 300,
  larguraIdeal: 600,
  proporcaoMinima: 0.6,   // mais estreita que isso corta o rosto
  proporcaoMaxima: 1.8,   // mais larga que isso vira paisagem
  tiposAceitos: ["image/jpeg", "image/png", "image/webp"],
};

export const APROVA_A_PARTIR_DE = 70;

// Cada checagem vale um peso e explica o que fazer. Uma nota sem instrução não
// ajuda ninguém a melhorar a própria foto.
export function avaliarFoto({ mimetype, tamanhoBytes, largura, altura }) {
  const checagens = [];
  const add = (chave, peso, ok, titulo, comoResolver) =>
    checagens.push({ chave, peso, ok, titulo, comoResolver: ok ? "" : comoResolver });

  const tipoOk = LIMITES.tiposAceitos.includes(mimetype);
  add("formato", 20, tipoOk, "Formato do arquivo",
    `Use JPG, PNG ou WebP. Recebemos "${mimetype || "desconhecido"}".`);

  const pesoOk = Number(tamanhoBytes) > 0 && Number(tamanhoBytes) <= LIMITES.tamanhoMaximoBytes;
  add("tamanho", 10, pesoOk, "Peso do arquivo",
    `A imagem precisa ter até ${Math.round(LIMITES.tamanhoMaximoBytes / 1024 / 1024)} MB.`);

  const resolucaoOk = largura >= LIMITES.larguraMinima && altura >= LIMITES.alturaMinima;
  add("resolucao", 30, resolucaoOk, "Resolução",
    `Mínimo de ${LIMITES.larguraMinima}×${LIMITES.alturaMinima} px. Sua imagem tem ${largura || "?"}×${altura || "?"}.`);

  const proporcao = largura && altura ? largura / altura : 0;
  const proporcaoOk = proporcao >= LIMITES.proporcaoMinima && proporcao <= LIMITES.proporcaoMaxima;
  add("enquadramento", 25, proporcaoOk, "Enquadramento",
    "Use uma foto aproximadamente quadrada ou vertical. Fotos muito largas cortam o rosto no avatar redondo.");

  const nitidaOk = largura >= LIMITES.larguraIdeal;
  add("definicao", 15, nitidaOk, "Definição",
    `Acima de ${LIMITES.larguraIdeal} px de largura a foto fica nítida em telas maiores.`);

  const pesoTotal = checagens.reduce((n, c) => n + c.peso, 0);
  const pesoOkTotal = checagens.filter((c) => c.ok).reduce((n, c) => n + c.peso, 0);
  const score = Math.round((pesoOkTotal / pesoTotal) * 100);

  // Formato inválido é eliminatório: não adianta a resolução estar ótima se o
  // navegador não vai conseguir exibir o arquivo.
  const aprovada = tipoOk && pesoOk && score >= APROVA_A_PARTIR_DE;

  return {
    score,
    aprovada,
    checagens,
    problemas: checagens.filter((c) => !c.ok).map((c) => ({ titulo: c.titulo, comoResolver: c.comoResolver })),
    // O que só uma análise de imagem responderia. Fica declarado como pendente
    // em vez de virar palpite.
    pendentesDeAnalise: [
      "Há um rosto suficientemente visível",
      "A pessoa é o assunto principal da foto",
      "Não é captura de tela, meme ou logotipo",
      "Iluminação e fundo adequados",
      "Sem conteúdo impróprio",
    ],
    observacao:
      "As checagens acima são técnicas e objetivas. A verificação de conteúdo da imagem " +
      "depende do provedor de visão do Audit Engine, que ainda não está configurado nesta " +
      "instalação — por isso ela aparece como pendente, e não como aprovada ou reprovada.",
  };
}

// Listas de referência do perfil comercial. Ficam aqui para servidor e tela
// usarem exatamente o mesmo vocabulário.
export const MODALIDADES = [
  "Telefone", "WhatsApp", "Presencial", "Porta a porta", "Videoconferência", "Social Selling", "E-mail",
];

export const SEGMENTOS = [
  "Tecnologia e SaaS", "Energia", "Contabilidade e serviços", "Imobiliário",
  "Seguros e financeiro", "Educação", "Varejo", "Indústria", "Saúde", "Agronegócio",
];

export const DISPONIBILIDADES = [
  { chave: "integral", nome: "Tempo integral" },
  { chave: "meio", nome: "Meio período" },
  { chave: "pontual", nome: "Projetos pontuais" },
  { chave: "fins", nome: "Fins de semana" },
];

export const SKILLS = [
  "Prospecção fria", "Cold call", "Social Selling", "Qualificação", "Discovery",
  "Negociação", "Fechamento", "Follow-up", "Gestão de carteira", "CRM",
  "Apresentação", "Contorno de objeções",
];
