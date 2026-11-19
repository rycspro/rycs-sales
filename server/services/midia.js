// Entrega um data URI guardado no banco como arquivo de verdade, com cache e
// suporte a Range (o Safari só toca vídeo e áudio se o servidor aceitar
// pedidos parciais).

export function enviarDataUri(req, res, dataUri) {
  const match = String(dataUri || "").match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s);
  if (!match) return res.status(404).end();
  const tipo = match[1];
  const buf = Buffer.from(match[2], "base64");
  res.set({
    "Content-Type": tipo,
    "Cache-Control": req.query.v ? "private, max-age=31536000, immutable" : "private, max-age=300",
    "Accept-Ranges": "bytes",
    // Conteúdo enviado por usuários, servido do nosso domínio: nada de script.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; media-src 'self'; sandbox",
    "X-Content-Type-Options": "nosniff",
  });

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range && (range[1] || range[2])) {
    let inicio = range[1] ? Number(range[1]) : buf.length - Number(range[2]);
    let fim = range[1] && range[2] ? Number(range[2]) : buf.length - 1;
    inicio = Math.max(0, inicio); fim = Math.min(buf.length - 1, fim);
    if (inicio > fim) return res.status(416).set("Content-Range", `bytes */${buf.length}`).end();
    res.status(206).set({ "Content-Range": `bytes ${inicio}-${fim}/${buf.length}`, "Content-Length": fim - inicio + 1 });
    return res.end(buf.subarray(inicio, fim + 1));
  }
  res.set("Content-Length", buf.length);
  res.end(buf);
}
