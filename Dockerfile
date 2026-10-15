# Transcrição local da fala (whisper.cpp), compilada à parte para a imagem
# final não carregar compilador. Código aberto (MIT), sem chave nem custo por uso.
FROM node:20-slim AS whisper
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch v1.7.4 https://github.com/ggml-org/whisper.cpp /src \
  && cmake -S /src -B /src/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF \
     -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF -DWHISPER_SDL2=OFF \
  && (cmake --build /src/build -j"$(nproc)" --target whisper-cli || cmake --build /src/build -j"$(nproc)" --target main) \
  && cp "$(ls /src/build/bin/whisper-cli /src/build/bin/main 2>/dev/null | head -1)" /usr/local/bin/whisper-cli
# Modelo "small" quantizado: bom em português e leve o bastante para a CPU.
RUN mkdir -p /modelos && curl -fsSL -o /modelos/ggml-small-q5_1.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin

FROM node:20-slim

WORKDIR /app

# Leitura interna dos materiais da etapa 3 do onboarding (leituraMateriais.js):
# ffmpeg (quadros e áudio dos vídeos), tesseract com português (OCR de fotos,
# quadros e PDFs escaneados) e poppler (páginas de PDF em imagem).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg tesseract-ocr tesseract-ocr-por poppler-utils \
  && rm -rf /var/lib/apt/lists/*
COPY --from=whisper /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper /modelos /modelos

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
