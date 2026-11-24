import { Router } from "express";
import {
  grupoDoToken, grupoDaEmpresa, painelGrupos, definirLinkPadrao, definirLink, pedirEnvio, processarGrupos, iniciarGruposSuporte,
} from "../services/grupoSuporte.js";

// Página /grupo-suporte: quem abre o botão do WhatsApp não tem sessão. O token
// é aleatório e só revela o nome da empresa e o convite do grupo dela.
export const grupoSuportePublico = Router();
grupoSuportePublico.get("/suporte/grupo/:token", (req, res) => {
  const g = grupoDoToken(req.params.token);
  if (!g) return res.status(404).json({ error: "Convite não encontrado." });
  res.set("Cache-Control", "no-store").json(g);
});

const router = Router();

router.get("/suporte/meu-grupo", (req, res) => {
  if (req.user?.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  res.json(grupoDaEmpresa(req.user.entityId) || {});
});

const soAdmin = (req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ error: "Acesso restrito ao administrador." }));
const agir = (f) => async (req, res) => {
  try {
    await f(req);
    processarGrupos().catch((e) => console.error("[grupo-suporte]", e?.message));
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

router.get("/admin/whatsapp/grupos", soAdmin, async (_req, res) => {
  try { res.json(await painelGrupos()); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post("/admin/whatsapp/grupos/padrao", soAdmin, agir((req) => definirLinkPadrao(String(req.body?.link || "").trim())));
router.post("/admin/whatsapp/grupos/:companyId/link", soAdmin, agir((req) => definirLink(req.params.companyId, req.body?.link)));
router.post("/admin/whatsapp/grupos/:companyId/enviar", soAdmin, agir((req) => pedirEnvio(req.params.companyId)));

iniciarGruposSuporte();

export default router;
