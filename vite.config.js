import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3001" } },
  build: {
    outDir: "dist",
    sourcemap: false,
    // O padrão do Vite mira Chrome 87 / Safari 14. Baixar para es2018 faz o
    // esbuild transpilar o que o navegador antigo não entende — campo privado
    // de classe, encadeamento opcional, coalescência nula — em vez de servir
    // sintaxe que ele não sabe ler e mostrar tela em branco.
    //
    // O custo é alguns kB. O benefício é o app abrir em navegador de celular
    // desatualizado, que é boa parte do público de quem vende na rua.
    target: "es2018",
  },
});
