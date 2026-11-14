import { Component } from "react";

// Sem isto, qualquer exceção de render derruba a árvore inteira e o usuário
// vê apenas uma página em branco, sem pista do que aconteceu.
//
// A tela mostra o ERRO REAL (mensagem, origem e um código curto), não um
// "algo deu errado" genérico: assim dá para saber o que corrigir sem precisar
// abrir o console. O código é derivado da mensagem — serve de referência ao
// relatar o problema.
function codigoDoErro(erro) {
  const base = `${erro?.name || "Error"}:${erro?.message || ""}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return `E-${h.toString(36).toUpperCase().slice(0, 6)}`;
}

export default class ErrorBoundary extends Component {
  state = { erro: null, info: null };

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    this.setState({ info });
    console.error("Erro de render:", erro, info?.componentStack);
  }

  render() {
    const { erro, info } = this.state;
    if (!erro) return this.props.children;

    const codigo = codigoDoErro(erro);
    const mensagem = erro?.message || String(erro);
    const origem = (info?.componentStack || "").trim().split("\n")[0]?.trim() || "";

    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div className="vx-card" style={{ padding: 24, maxWidth: 520, textAlign: "left" }}>
          <div className="vx-disp" style={{ fontSize: 18, marginBottom: 8, textAlign: "center" }}>Ocorreu um erro nesta tela</div>

          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", margin: "4px 0 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <span className="vx-mut" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Código</span>
              <code className="vx-mono" style={{ fontSize: 12.5, color: "var(--brand)", fontWeight: 700 }}>{codigo}</code>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5, wordBreak: "break-word" }}>
              <b>{erro?.name || "Error"}:</b> {mensagem}
            </div>
            {origem && (
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 6, wordBreak: "break-word" }}>em {origem}</div>
            )}
          </div>

          {info?.componentStack && (
            <details style={{ marginBottom: 14 }}>
              <summary className="vx-mut" style={{ fontSize: 12, cursor: "pointer" }}>Detalhes técnicos</summary>
              <pre style={{ fontSize: 11, lineHeight: 1.5, color: "var(--muted)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 8, overflowX: "auto", whiteSpace: "pre-wrap" }}>
{String(erro?.stack || "").split("\n").slice(0, 4).join("\n")}{info.componentStack}
              </pre>
            </details>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="vx-btn vx-btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <button className="vx-btn" style={{ justifyContent: "center" }}
              onClick={() => { try { navigator.clipboard?.writeText(`${codigo} — ${erro?.name || "Error"}: ${mensagem}`); } catch { /* */ } }}>
              Copiar erro
            </button>
          </div>
        </div>
      </div>
    );
  }
}
