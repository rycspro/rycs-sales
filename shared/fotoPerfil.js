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
  tamanhoMaximoBytes: 10 * 1024 * 1024,
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

// Orientação mostrada ANTES do upload. Sem isso a pessoa descobre o padrão
// errando: manda a foto, leva recusa e precisa adivinhar o que corrigir.
export const GUIA_FOTO = {
  titulo: "Como deve ser a sua foto",
  requisitos: [
    { chave: "formato", texto: "JPG, PNG ou WebP", detalhe: "Formatos que qualquer navegador exibe." },
    { chave: "resolucao", texto: `No mínimo ${LIMITES.larguraMinima}×${LIMITES.alturaMinima} px`, detalhe: `Acima de ${LIMITES.larguraIdeal} px fica nítida em telas grandes.` },
    { chave: "enquadramento", texto: "Quadrada ou vertical", detalhe: "O avatar é redondo: foto muito larga corta o rosto." },
    { chave: "tamanho", texto: `Até ${Math.round(LIMITES.tamanhoMaximoBytes / 1024 / 1024)} MB`, detalhe: "Arquivo maior que isso é recusado." },
  ],
  recomendado: [
    "Rosto ocupando boa parte do quadro, do peito para cima",
    "Luz na frente do rosto, não atrás",
    "Fundo simples, sem poluição visual",
    "Você sozinho na foto",
  ],
  evitar: [
    "Captura de tela ou foto de outra foto",
    "Logotipo, desenho ou meme no lugar do rosto",
    "Foto de corpo inteiro ou muito distante",
    "Imagem escura, tremida ou desfocada",
  ],
};

// Miniatura que ilustra o enquadramento certo e o errado. Gerada, para não
// depender de arquivo hospedado nem de foto de pessoa real.
export function exemploEnquadramento(tipo = "certo") {
  const certo = tipo === "certo";
  const cor = certo ? "#5B8CFF" : "#FF8A7A";
  // No exemplo correto a cabeça ocupa o terço superior e o busto entra no
  // quadro. No errado, a pessoa aparece pequena e distante.
  const r = certo ? 26 : 10;
  const cy = certo ? 46 : 34;
  const bustoY = certo ? 78 : 48;
  const bustoR = certo ? 40 : 15;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<rect width="120" height="120" rx="14" fill="#0E1524"/>
<rect x="2" y="2" width="116" height="116" rx="13" fill="none" stroke="${cor}" stroke-width="2" stroke-dasharray="${certo ? "0" : "5 4"}"/>
<circle cx="60" cy="${cy}" r="${r}" fill="${cor}" opacity=".9"/>
<ellipse cx="60" cy="${bustoY + bustoR}" rx="${bustoR}" ry="${bustoR * .8}" fill="${cor}" opacity=".65"/>
<text x="60" y="112" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="${cor}">${certo ? "ASSIM" : "ASSIM NÃO"}</text>
</svg>`;
  const b64 = typeof Buffer !== "undefined"
    ? Buffer.from(svg, "utf8").toString("base64")
    : btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${b64}`;
}
