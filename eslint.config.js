// Lint focado em erros de runtime no backend: variável ou import indefinido
// (ReferenceError) que o `node --check` e o build não pegam — a classe do bug
// do `SELECT telefone FROM users`. Escopo server/ + shared/ (ESM, sem JSX); o
// frontend tem build próprio e fica fora por ora.
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "dist/**", "public/**", ".claude/**"] },
  {
    files: ["server/**/*.js", "shared/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "off",
    },
  },
];
