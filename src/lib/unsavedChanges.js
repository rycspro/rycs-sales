import { useEffect } from "react";

// Avisa o navegador quando há alterações não salvas: enquanto `pendente` for
// verdadeiro, fechar ou recarregar a aba dispara a confirmação nativa do
// navegador. Some assim que as mudanças são salvas (pendente volta a falso).
let _pendente = false;
export function canNavigate() { return !_pendente; }

export function useUnsavedChanges(pendente) {
  _pendente = !!pendente;
  useEffect(() => {
    if (!pendente) return;
    const handler = (e) => {
      e.preventDefault();
      // Exigido por navegadores antigos para mostrar o aviso.
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendente]);
}
