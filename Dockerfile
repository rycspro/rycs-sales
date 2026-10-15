FROM node:20-slim

WORKDIR /app

# ffmpeg: quadros e áudio dos vídeos da etapa 3 do onboarding (leituraMateriais.js).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
