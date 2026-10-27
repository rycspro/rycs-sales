import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { UFS, buscarMunicipios } from "../../lib/ibge.js";

export default function CidadeEstadoSelector({ estado, cidade, onEstado, onCidade }) {
  const [municipios, setMunicipios] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!estado) { setMunicipios([]); onCidade?.(""); return; }
    setCarregando(true);
    buscarMunicipios(estado).then((lista) => {
      setMunicipios(lista);
      setCarregando(false);
      // Se a cidade atual não está na lista do novo estado, limpa
      if (cidade && !lista.includes(cidade)) onCidade?.("");
    });
  }, [estado]);

  return (
    <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
      <label>
        <div className="vx-label"><MapPin size={12} style={{ verticalAlign: -1 }} /> Estado <span style={{ color: "var(--danger)" }}>*</span></div>
        <select className="vx-input" value={estado} onChange={(e) => onEstado?.(e.target.value)}>
          <option value="">Selecione o estado</option>
          {UFS.map((uf) => <option key={uf.sigla} value={uf.sigla}>{uf.nome} ({uf.sigla})</option>)}
        </select>
      </label>
      <label>
        <div className="vx-label">Cidade <span style={{ color: "var(--danger)" }}>*</span></div>
        <select className="vx-input" value={cidade} onChange={(e) => onCidade?.(e.target.value)} disabled={!estado || carregando}>
          <option value="">{carregando ? "Carregando…" : !estado ? "Selecione o estado primeiro" : "Selecione a cidade"}</option>
          {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
    </div>
  );
}
