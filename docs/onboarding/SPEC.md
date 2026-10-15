# SPEC: Fluxo de cadastro (onboarding) da empresa na RYCS

## 1. Contexto

A RYCS é uma plataforma SaaS B2B que conecta empresas a vendedores. Já existe um sistema em produção. Sua tarefa é implementar, dentro dele, um novo fluxo de cadastro guiado para empresas, em 6 etapas, do login até a publicação da primeira campanha.

Antes de escrever código:
1. Leia a estrutura atual do projeto (framework, rotas, autenticação, componentes de UI, banco de dados, convenções de nomes).
2. Reaproveite o que já existe (auth, componentes, estilos, serviços). Não recrie o que o projeto já tem.
3. Se algo desta especificação conflitar com a arquitetura existente, siga a arquitetura existente e liste o conflito no final.
4. Faça em etapas pequenas e entregue na ordem da seção 10.

## Referências neste pacote

- Cores, fontes e medidas: `design/tokens.css` e `design/tokens.json`.
- Telas desenhadas: `design/reference/` (`Main` = etapa 1, `Empresa` = 2, `Academy` = 3, `IA` = 4a, `Aprovacao` = 4b, `Plano` = 5, `Campanha` = 6). Use como referência de layout, textos, campos e estados. Recrie no framework do projeto; não copie o HTML.
- Se houver conflito entre a tela de referência e esta especificação, vale a especificação.

## 2. Objetivo

Um fluxo linear, simples e retomável, em que a empresa:
1. Cria o acesso (e-mail e senha).
2. Preenche o perfil da empresa.
3. Envia materiais de marketing (Marketing Academy).
4. Deixa a IA RAG gerar script, funil de WhatsApp e follow-ups, e aprova o resultado.
5. Escolhe o plano e cadastra o cartão (7 dias grátis).
6. Sobe a primeira campanha, já dentro da plataforma.

## 3. Regras gerais de UX

- Idioma: português do Brasil em toda a interface.
- Um indicador de progresso fixo no topo, com 6 passos: Acesso, Empresa, Marketing Academy, IA RAG, Plano, Campanha. Estados: concluído (verde com check), atual (destaque), pendente (contorno).
- Cada etapa tem título, uma frase de apoio, botão principal "Continuar" (ou equivalente) e botão "Voltar".
- O progresso é salvo no servidor a cada etapa. Se a empresa sair e voltar, retoma exatamente de onde parou.
- Não permitir pular etapas pela URL: redirecionar para a primeira etapa não concluída.
- Validação inline, mensagens de erro claras, sem perder o que o usuário digitou.
- Acessibilidade: todo campo com `label`, foco visível, alvos de toque de pelo menos 44px, botões de ícone com `aria-label`, contraste mínimo 4.5:1 no texto.
- Responsivo: funciona em celular (390px) e desktop (1280px+).
- Respeitar `prefers-reduced-motion` nas animações.

## 4. Identidade visual

Se o projeto já tiver design system ou tokens, use-os. Caso contrário, use:

- Fundo escuro de destaque: `#070B1E` (navy). Texto principal: `#070B1E` sobre claro.
- Fundo das telas: `#F5F6FA`. Cartões: `#FFFFFF` com borda `#E3E5EE` e raio 20px.
- Destaque (botões, links, etapa atual): `#0E7490` com texto branco. Ciano `#22D3EE` apenas em fundos escuros.
- Sucesso: `#0F9D6B` (ícone) e `#0B7A53` (texto). Texto secundário: `#5B6075`. Borda de campos: `#9097AE`.
- Títulos: Bricolage Grotesque (600 a 800). Corpo: Plus Jakarta Sans (400 a 700).
- Campos: altura 48px, raio 12px. Botão principal: altura 52px, raio 12px.

## 5. Especificação por etapa

### Etapa 1: Acesso (login e senha)

Campos: e-mail, senha.

- Botão de olho (aberto/fechado) dentro do campo de senha, alternando entre senha visível e oculta. `aria-label` muda entre "Mostrar senha" e "Ocultar senha".
- Regra de senha: mínimo de 8 caracteres. Mostrar a regra como dica abaixo do campo.
- Link "Esqueci minha senha" abre o modo de recuperação na mesma tela:
  - Campo de e-mail e botão "Enviar link de recuperação".
  - Tela de confirmação "Link enviado" com orientação para olhar o spam, botão "Reenviar link" (com mensagem "Enviamos um novo link agora") e "Voltar ao login".
  - O link leva a uma página para definir nova senha. O token expira e só vale uma vez.
  - Limitar reenvios (ex.: intervalo mínimo entre envios) para evitar abuso. Não revelar se o e-mail existe ou não.
- Texto abaixo do botão: "Ao continuar, você aceita os Termos de Uso da RYCS", com link para os Termos.
- Se o projeto já tem login e recuperação de senha, apenas adapte a interface ao que está descrito.

### Etapa 2: Perfil da empresa

Seções e campos:
- **Identidade:** logo (upload PNG/SVG, preferir fundo transparente), nome da empresa.
- **O que você vende:** produto e serviço (texto longo), ticket do produto (valor em R$, valor médio de uma venda).
- **Mercado e posicionamento:** detalhes do nicho, diferencial, público (textos longos).
- **Marca:** regras da marca (texto longo: tom de voz, o que sempre/nunca dizer) e permissões da marca (caixas de seleção do que a IA pode fazer sozinha): informar preços, oferecer descontos e condições especiais, combinar prazos, usar emojis.
- Coluna lateral explicando por que perguntamos: a IA usa isso para falar como a marca.
- Obrigatórios: nome da empresa, produto e serviço, público. Os demais são recomendados.
- Botões: "Voltar" e "Salvar e continuar".

### Etapa 3: Marketing Academy

Todo o material de marketing e divulgação da empresa entra aqui. Cartões de envio:
- Apresentações (PDF, PPT, KEY)
- Material explicativo detalhado (PDF, DOC, XLS, TXT)
- Fotos (JPG, PNG, WEBP)
- Vídeos (MP4, MOV)
- Áudios (MP3, WAV, M4A)
- Links (campo de URL com botão "Adicionar": site, redes, catálogo, YouTube, páginas de venda)
- Contato de suporte: nome, WhatsApp, e-mail (para quem a IA encaminha a conversa quando precisar de uma pessoa)

Requisitos:
- Arrastar e soltar e seleção por clique, com barra de progresso, lista de arquivos enviados e opção de remover.
- Validar tipo e tamanho. Definir limites razoáveis e mostrá-los na interface.
- Armazenar em storage de arquivos (não no banco). Guardar apenas metadados e a URL.
- Botão final: "Enviar para a IA analisar". Ao menos um material ou link é recomendado, mas não bloqueia.

### Etapa 4: IA RAG (a IA faz sozinha)

Dividida em duas telas.

**4a. IA trabalhando (sem ação do dono da empresa):**
- Mostrar um palco central com animação (GIF ou animação em CSS) e a lista lateral de fases com estado concluído/atual/pendente:
  1. Analisando as informações
  2. Criando o script
  3. Criando as estratégias do funil de WhatsApp
  4. Criando os follow-ups
  5. Aguardando a sua aprovação
- Cada fase tem um título e uma frase própria ("Lendo o perfil da empresa e os materiais enviados", etc.) e uma animação diferente.
- Backend: processar em segundo plano (fila/job). Indexar os materiais da etapa 3 para RAG (extrair texto, gerar embeddings, armazenar em vetor), e usar também o perfil da etapa 2. O front acompanha o status por polling ou eventos em tempo real.
- Tratar falhas: se uma fase falhar, mostrar mensagem clara e botão "Tentar novamente". Não perder o progresso das fases concluídas.
- Quando terminar, mostrar "Tudo pronto para revisar" e botão "Revisar estratégias".

**4b. Aprovação do dono:**
- Três blocos, cada um com "Editar" e "Aprovar" (alterna para "Aprovado"):
  - Script de vendas: abertura, qualificação, oferta, fechamento.
  - Funil de WhatsApp: boas-vindas, qualificação, oferta, objeções, fechamento (com uma frase por etapa).
  - Follow-ups: sequência de mensagens com o momento de envio (ex.: após 1 hora, 1 dia, 3 dias).
- Os textos usam variáveis como `{nome}`, `{empresa}`, `{produto}`, `{ticket}`, `{diferencial}`, `{contato de suporte}`. Explicar isso na tela.
- Barra inferior: contador "X de 3 partes aprovadas", botão "Pedir ajustes" (abre um campo de texto e reenvia o pedido à IA para regenerar) e botão "Aprovar tudo e continuar".
- Nada vira ativo antes da aprovação. Guardar as versões geradas e a aprovada.

### Etapa 5: Plano e pagamento

- Mensagem principal: "Escolha seu plano e comece com 7 dias grátis". A cobrança só começa depois dos 7 dias.
- Lista de planos como seleção única (radio). **Não invente nomes, preços nem recursos:** leia de uma configuração/tabela de planos que já exista, ou crie uma tabela configurável e deixe os valores para eu preencher.
- Painel de pagamento: nome no cartão, número, validade, CVV, com `autocomplete` correto (`cc-name`, `cc-number`, `cc-exp`, `cc-csc`).
- Resumo: plano escolhido, "Cobrado hoje: R$ 0,00", "Primeira cobrança: daqui a 7 dias" (mostrar a data real).
- Use o gateway de pagamento que o projeto já usa. **Nunca** guarde número de cartão ou CVV no nosso banco: use tokenização do gateway.
- Tratar cartão recusado com mensagem clara e nova tentativa.
- Botão: "Começar os 7 dias grátis". Iniciar o período de teste e redirecionar para a etapa 6.

### Etapa 6: Primeira campanha

- Redirecionar para o ambiente de campanhas da plataforma (menu lateral completo: Campanhas, Conversas, Funil e IA, Marketing Academy, Configurações). Indicar "Teste grátis ativo" no menu.
- Título: "Cadastro concluído. Suba sua primeira campanha." Mostrar selos das etapas concluídas.
- Formulário "Nova campanha":
  - Nome da campanha
  - Remuneração do vendedor (comissão por venda, valor fixo por atividade ou comissão e valor fixo) e valor/percentual
  - RYCS Score mínimo do vendedor (opcional)
  - Perfil do vendedor desejado (texto)
  - Materiais da campanha (escolher da Marketing Academy)
  - Estratégias aplicadas (somente leitura): script, funil de WhatsApp e follow-ups aprovados
- Botões: "Salvar rascunho" e "Publicar campanha".
- Ao publicar, marcar o onboarding como concluído e levar a empresa à listagem de campanhas.
- Use os modelos e regras de campanha que já existem no sistema. Se já houver tela de criação de campanha, reutilize-a aqui em vez de duplicar.

## 6. Modelo de dados (adapte ao banco existente)

- `onboarding`: empresa_id, etapa_atual (1 a 6), status por etapa, concluido_em.
- `empresa_perfil`: logo_url, nome, produto_servico, ticket, nicho, diferencial, publico, regras_marca, permissoes (json).
- `academy_material`: empresa_id, tipo (apresentacao, material, foto, video, audio, link), nome, url, tamanho, status_indexacao.
- `academy_contato_suporte`: empresa_id, nome, whatsapp, email.
- `ia_geracao`: empresa_id, fase, status, versao, conteudo (json), aprovado (bool), aprovado_em, erro.
- `assinatura`: empresa_id, plano_id, status (trial, ativa, cancelada), trial_ate, gateway_customer_id, gateway_payment_method_id.
- Todas as tabelas com created_at e updated_at e isolamento por empresa (multi-tenant).

## 7. Segurança e privacidade

- Autenticação e autorização em todas as rotas e endpoints do fluxo. Cada empresa só acessa os próprios dados.
- Senhas com hash forte. Tokens de recuperação aleatórios, de uso único e com expiração.
- Validar e sanitizar todos os campos e uploads (tipo, tamanho, varredura básica). Gerar URLs de arquivos com segurança.
- Não registrar em log senhas, tokens, dados de cartão ou conteúdo sensível dos materiais.
- Respeitar a LGPD: finalidade clara, e a possibilidade de excluir materiais enviados.

## 8. Estados que precisam existir em todas as telas

Carregando, vazio, erro com ação de tentar de novo, sucesso e salvando (botão desabilitado com indicador). Nunca deixar o usuário sem resposta visual.

## 9. Critérios de aceite

- Um usuário novo percorre as 6 etapas do começo ao fim sem erro, em celular e desktop.
- Fechar o navegador no meio e voltar retoma na etapa correta, com os dados preenchidos.
- O olho da senha, a recuperação por link e o reenvio funcionam.
- A IA gera script, funil e follow-ups a partir do perfil e dos materiais, e nada é ativado antes da aprovação.
- O cartão é cadastrado por tokenização, com R$ 0,00 hoje e primeira cobrança em 7 dias.
- A primeira campanha é publicada e o onboarding é marcado como concluído.
- Testes automatizados cobrindo: validações, retomada do progresso, acesso entre empresas negado, falha da IA com nova tentativa e cartão recusado.

## 10. Ordem de entrega

1. Estrutura do onboarding (rotas, progresso fixo, salvar e retomar) e etapa 1.
2. Etapa 2 (perfil) e etapa 3 (Marketing Academy com uploads).
3. Pipeline da IA RAG (indexação, geração, status) e telas 4a e 4b.
4. Etapa 5 (planos, trial e tokenização do cartão).
5. Etapa 6 (campanha) e redirecionamento ao ambiente de campanhas.
6. Testes, acessibilidade e revisão final.

Ao concluir cada passo, resuma o que foi feito, os arquivos alterados, e o que ficou pendente ou depende de uma decisão minha.

## 11. O que eu preciso informar depois

- Nomes, preços e recursos dos planos.
- Limites de tamanho de arquivo por tipo.
- Textos finais dos Termos de Uso e da Política de Privacidade.
- Qual gateway de pagamento e qual provedor de e-mail transacional usar, caso o projeto ainda não tenha.
