// Service worker desativado.
//
// A versão anterior cacheava o index.html com estratégia cache-first, o que
// deixava clientes presos a um HTML antigo apontando para bundles que já não
// existiam — resultando em tela branca após cada deploy.
//
// Este arquivo agora só limpa o cache e se desregistra. Não reintroduza cache
// de HTML aqui: o app é online-only e depende da API para tudo.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});
