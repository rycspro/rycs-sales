import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { I18nProvider } from "./lib/i18n.jsx";
import { capturarOrigem, carregarPixel, rastrear } from "./lib/rastreio.js";

capturarOrigem();
carregarPixel();
rastrear("visita");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
