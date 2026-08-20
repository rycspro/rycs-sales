# Sales Machine

Projeto React (Vite) gerado a partir do artifact construído no chat. Pronto pra abrir
no Claude Code e continuar evoluindo como um app de verdade, fora do sandbox do claude.ai.

## O que já está pronto
- `src/App.jsx` — o app inteiro (papéis Vendedor / Empresa / Plataforma), sem alterações
  em relação ao artifact.
- `src/main.jsx` — inclui um "shim" que recria a API `window.storage` usando `localStorage`,
  porque essa API só existe dentro do artifact do claude.ai. Sem essa parte, o app quebraria
  ao tentar salvar dados.

## O que ainda depende do ambiente do claude.ai
A análise por IA (`analisarComIA`, dentro de `App.jsx`) chama `https://api.anthropic.com/v1/messages`
direto do navegador, sem chave — isso só funciona dentro do artifact do claude.ai, que faz esse
proxy por você. Fora dali, essa chamada vai falhar (CORS / falta de autenticação), e o app cai
automaticamente no fallback local (`heuristicaLocal`), que já está no código — ou seja, o app
continua funcionando, só que sem a IA de verdade.

Para ter a IA de verdade rodando fora do claude.ai, é preciso um backend simples (Node/Express,
Next.js API route, etc.) que guarde a `ANTHROPIC_API_KEY` no servidor e repasse a chamada — isso é
exatamente o tipo de tarefa que o Claude Code resolve bem se você pedir.

## Passo a passo

### 1. Instalar o Claude Code (se ainda não tiver)
```bash
# macOS, Linux ou WSL
curl -fsSL https://claude.ai/install.sh | bash
```
```powershell
# Windows PowerShell
irm https://claude.ai/install.ps1 | iex
```
Confirme com `claude --version`. Precisa de uma conta Pro, Max, Team ou Enterprise
(o plano gratuito do claude.ai não dá acesso ao Claude Code).

### 2. Colocar este projeto em uma pasta local
Baixe os arquivos deste projeto e coloque numa pasta, por exemplo `~/projetos/sales-machine`.

### 3. Abrir o Claude Code na pasta do projeto
```bash
cd ~/projetos/sales-machine
claude
```
Na primeira vez ele abre o navegador para autenticar com sua conta Anthropic.

### 4. Instalar as dependências e rodar
Dentro da sessão do Claude Code (ou no terminal normal):
```bash
npm install
npm run dev
```
Abre em `http://localhost:5173`.

### 5. Seguir evoluindo com o Claude Code
A partir daqui é só pedir em linguagem natural, por exemplo:
- "monta um backend simples em Node pra guardar a ANTHROPIC_API_KEY e fazer a análise por IA de verdade"
- "troca o localStorage por um banco de dados real (Postgres/Supabase)"
- "adiciona autenticação de verdade pro vendedor e pra empresa"
- "prepara isso pra deploy na Vercel"
