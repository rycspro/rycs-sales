import { useRef, useState } from "react";
import { Upload, X, Image, Film, FileText, Link2 } from "lucide-react";
import { parse as parseExif, gps as parseGps } from "exifr";

// A captura de câmera feita dentro de um site (não pelo app nativo) às vezes
// não grava GPS no EXIF, mesmo com a permissão de localização ligada — é uma
// limitação do próprio navegador (comum no Safari/iOS). Por isso pedimos a
// posição direto da API do navegador como fonte principal, e só caímos para o
// EXIF da foto se o navegador negar ou falhar.
function obterLocalizacaoNavegador() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

// Metadados da foto — horário e geolocalização — ficam visíveis para a
// empresa e compõem a análise de integridade da evidência.
// GPS do EXIF usa a função dedicada exifr.gps(): "latitude"/"longitude" não
// são tags EXIF reais (são GPSLatitude/GPSLongitude), então pedi-las via
// `pick` do parse() genérico descarta o bloco de GPS inteiro antes de
// computá-las.
async function extrairMetadadosFoto(file) {
  try {
    const [datas, exifCoords, navCoords] = await Promise.all([
      parseExif(file, { pick: ["DateTimeOriginal", "CreateDate"] }).catch(() => null),
      parseGps(file).catch(() => null),
      obterLocalizacaoNavegador(),
    ]);
    const metadata = {};
    if (datas?.DateTimeOriginal || datas?.CreateDate) {
      metadata.capturadoEm = new Date(datas.DateTimeOriginal || datas.CreateDate).toISOString();
    }
    const coords = navCoords || exifCoords;
    if (typeof coords?.latitude === "number" && typeof coords?.longitude === "number") {
      metadata.latitude = coords.latitude;
      metadata.longitude = coords.longitude;
      metadata.origemLocalizacao = navCoords ? "navegador" : "exif";
    }
    return Object.keys(metadata).length ? metadata : null;
  } catch {
    return null;
  }
}

const ACCEPT = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4,video/webm,video/mov,video/avi",
  audio: "audio/mpeg,audio/webm,audio/ogg,audio/wav",
  document: "application/pdf,.pdf",
  any: "image/*,video/*,audio/*,application/pdf",
};

const ICONS = { image: Image, video: Film, document: FileText };

function tipoDoSlot(slot) {
  if (["video_or_recording", "call_recording"].includes(slot)) return "video";
  if (["visit_proof", "scheduling_confirmation", "follow_proof", "contact_proof", "closing_proof"].includes(slot)) return "image";
  if (["qualification_summary", "meeting_summary", "meeting_data", "call_log", "visit_result", "sale_data"].includes(slot)) return "text";
  return "image";
}

function allowLink(slot) {
  return ["video_or_recording", "call_recording", "scheduling_confirmation", "follow_proof", "contact_proof", "closing_proof"].includes(slot);
}

export default function UploadEvidencia({ slot, value, onChange, placeholder }) {
  const fileRef = useRef();
  const tipo = tipoDoSlot(slot);
  const podeLink = allowLink(slot);
  // Evidência de foto que não aceita link (ex: prova de visita) é sempre uma
  // foto real do local — força abrir a câmera na hora, sem opção de galeria,
  // pra eliminar foto antiga sem GPS. Campos que aceitam link (print de
  // conversa, confirmação) continuam podendo escolher da galeria: ali a
  // evidência costuma já existir como captura de tela.
  const forcarCamera = tipo === "image" && !podeLink;

  const [modo, setModo] = useState(() => {
    if (tipo === "text") return "texto";
    if (value && (value.startsWith("http") || value.startsWith("data:"))) {
      return value.startsWith("data:") ? "upload" : "link";
    }
    return "upload";
  });

  const isDataUrl = value && value.startsWith("data:");
  const isLink = value && value.startsWith("http");
  const Icon = ICONS[tipo] || Upload;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const metadata = tipo === "image" ? await extrairMetadadosFoto(file) : null;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange(ev.target.result, metadata);
    };
    reader.readAsDataURL(file);
  }

  if (tipo === "text") {
    return (
      <textarea
        className="vx-input"
        style={{ minHeight: 72, resize: "vertical" }}
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div>
      {podeLink && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button
            type="button"
            className="vx-btn vx-btn-sm"
            data-on={modo === "upload" ? "1" : "0"}
            style={{ flex: 1, fontSize: 11.5 }}
            onClick={() => setModo("upload")}
          >
            <Upload size={12} /> Fazer upload
          </button>
          <button
            type="button"
            className="vx-btn vx-btn-sm"
            data-on={modo === "link" ? "1" : "0"}
            style={{ flex: 1, fontSize: 11.5 }}
            onClick={() => setModo("link")}
          >
            <Link2 size={12} /> Colar link
          </button>
        </div>
      )}

      {modo === "link" ? (
        <input
          className="vx-input"
          placeholder={placeholder || "https://..."}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div>
          {isDataUrl ? (
            <div style={{ position: "relative", marginBottom: 6 }}>
              {tipo === "image" && (
                <img
                  src={value}
                  alt="preview"
                  style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, background: "var(--surface-3)" }}
                />
              )}
              {tipo === "video" && (
                <video
                  src={value}
                  controls
                  style={{ width: "100%", maxHeight: 200, borderRadius: 8, background: "#000" }}
                />
              )}
              <button
                type="button"
                onClick={() => { onChange(""); fileRef.current && (fileRef.current.value = ""); }}
                style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={14} color="#fff" />
              </button>
            </div>
          ) : isLink ? (
            <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px", fontSize: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Link2 size={12} color="var(--brand)" />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
              <button type="button" onClick={() => onChange("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}>
                <X size={14} color="var(--muted)" />
              </button>
            </div>
          ) : null}

          {!isDataUrl && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{ width: "100%", padding: "14px", border: "2px dashed var(--border)", borderRadius: 10, background: "var(--surface-2)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--ink-2)" }}
            >
              <Icon size={20} color="var(--brand)" />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                {forcarCamera ? "Tirar foto agora" : tipo === "image" ? "Selecionar imagem" : tipo === "video" ? "Selecionar vídeo" : "Selecionar arquivo"}
              </span>
              <span style={{ fontSize: 11 }}>
                {forcarCamera ? "Abre a câmera do aparelho — não é possível escolher da galeria" : `PNG, JPG, WEBP${tipo === "video" ? ", MP4, WEBM" : ""} · máx 50MB`}
              </span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT[tipo] || ACCEPT.any}
            capture={forcarCamera ? "environment" : undefined}
            style={{ display: "none" }}
            onChange={handleFile}
          />
        </div>
      )}
    </div>
  );
}
