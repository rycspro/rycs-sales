import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { UFS, buscarMunicipios } from "../../lib/ibge.js";
import { useI18n } from "../../lib/i18n.jsx";

export default function CidadeEstadoSelector({ estado, cidade, onEstado, onCidade }) {
  const { t } = useI18n();
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
        <div className="vx-label"><MapPin size={12} style={{ verticalAlign: -1 }} /> {t("location.state")} <span style={{ color: "var(--danger)" }}>*</span></div>
        <select className="vx-input" value={estado} onChange={(e) => onEstado?.(e.target.value)}>
          <option value="">{t("location.selectState")}</option>
          {UFS.map((uf) => <option key={uf.sigla} value={uf.sigla}>{uf.nome} ({uf.sigla})</option>)}
        </select>
      </label>
      <label>
        <div className="vx-label">{t("location.city")} <span style={{ color: "var(--danger)" }}>*</span></div>
        <select className="vx-input" value={cidade} onChange={(e) => onCidade?.(e.target.value)} disabled={!estado || carregando}>
          <option value="">{carregando ? t("misc.loading") : !estado ? t("location.selectStateFirst") : t("location.selectCity")}</option>
          {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
    </div>
  );
}
