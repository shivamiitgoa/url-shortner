import { Router } from "express";
import { z } from "zod";
import { config } from "../config";
import { AuthenticatedRequest } from "../lib/auth";
import { CollisionError, UrlRepository } from "../lib/spanner";
import { generateBase62Code, isValidHttpUrl, normalizeAlias } from "../lib/utils";

const createSchema = z.object({
  longUrl: z.string().url(),
  customAlias: z.string().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  redirectType: z.union([z.literal(301), z.literal(302)]).optional()
});

const updateSchema = z.object({
  status: z.union([z.literal("ACTIVE"), z.literal("DISABLED")]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  redirectType: z.union([z.literal(301), z.literal(302)]).optional()
});

export function urlsRouter(repository: UrlRepository): Router {
  const router = Router();

  router.post("/", async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { longUrl, customAlias, expiresAt, redirectType } = parsed.data;
    if (!isValidHttpUrl(longUrl)) {
      res.status(400).json({ error: "longUrl must be http or https" });
      return;
    }

    const desiredCode = customAlias ? normalizeAlias(customAlias) : null;
    if (customAlias && !desiredCode) {
      res.status(400).json({ error: "customAlias is invalid" });
      return;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = desiredCode ?? generateBase62Code(8);
      try {
        const created = await repository.createUrl({
          code,
          longUrl,
          ownerUid: user.uid,
          expiresAt: expiresAt ?? null,
          redirectType: redirectType ?? 302
        });

        res.status(201).json({
          ...created,
          shortUrl: `${config.publicBaseUrl}/${created.code}`
        });
        return;
      } catch (error) {
        if (error instanceof CollisionError) {
          if (desiredCode) {
            res.status(409).json({ error: "customAlias already in use" });
            return;
          }
          continue;
        }

        res.status(500).json({ error: "Failed to create URL", detail: String(error) });
        return;
      }
    }

    res.status(500).json({ error: "Failed to allocate unique short code" });
  });

  router.get("/", async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const limit = Number(req.query.limit ?? 100);
    const results = await repository.listByOwner(user.uid, Math.min(Math.max(limit, 1), 500));
    res.status(200).json({ items: results });
  });

  router.patch("/:code", async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const code = String(req.params.code);
    const updated = await repository.updateByOwner(user.uid, code, parsed.data);

    if (!updated) {
      res.status(404).json({ error: "URL not found" });
      return;
    }

    res.status(200).json(updated);
  });

  router.delete("/:code", async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const code = String(req.params.code);
    const deleted = await repository.softDeleteByOwner(user.uid, code);

    if (!deleted) {
      res.status(404).json({ error: "URL not found" });
      return;
    }

    res.status(204).send();
  });

  return router;
}
