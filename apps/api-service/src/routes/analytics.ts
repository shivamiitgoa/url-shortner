import { Router } from "express";
import { AuthenticatedRequest } from "../lib/auth";
import { fetchDailyAnalytics } from "../lib/analytics";
import { UrlRepository } from "../lib/spanner";

export function analyticsRouter(repository: UrlRepository): Router {
  const router = Router();

  router.get("/:code", async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const code = String(req.params.code);
    const record = await repository.getByCode(code);

    if (!record || record.ownerUid !== user.uid || record.status === "DELETED") {
      res.status(404).json({ error: "URL not found" });
      return;
    }

    const from = String(req.query.from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
    const to = String(req.query.to ?? new Date().toISOString().slice(0, 10));

    const items = await fetchDailyAnalytics(code, from, to);
    res.status(200).json({ code, from, to, items });
  });

  return router;
}
