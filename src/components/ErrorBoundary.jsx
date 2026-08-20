import { Component } from "react";

// Sem isto, qualquer exceção de render derruba a árvore inteira e o usuário
// vê apenas uma página em branco, sem pista do que aconteceu.
export default class ErrorBoundary extends Component {
  state = { erro: null };

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("Erro de render:", erro, info?.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div className="vx-card" style={{ padding: 24, maxWidth: 420, textAlign: "center" }}>
          <div className="vx-disp" style={{ fontSize: 18, marginBottom: 8 }}>Algo deu errado</div>
          <p className="vx-mut" style={{ fontSize: 13.5, marginBottom: 16 }}>
            Não conseguimos carregar esta tela. Tente recarregar a página.
          </p>
          <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
