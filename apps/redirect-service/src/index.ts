import express from "express";
import { config } from "./config";
import { cacheUrl, connectCache, getCachedUrl } from "./lib/cache";
import { publishClick } from "./lib/pubsub";
import { evaluateRedirect } from "./lib/resolve";
import { getUrlByCode } from "./lib/spanner";

const app = express();

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, service: "redirect-service" });
});

app.get("/:code", async (req, res) => {
  const code = String(req.params.code || "").trim();
  if (!code) {
    res.status(404).send("Not found");
    return;
  }

  try {
    let record = await getCachedUrl(code);
    if (!record) {
      record = await getUrlByCode(code);
      if (record) {
        await cacheUrl(record);
      }
    }

    const decision = evaluateRedirect(record);
    if (!decision.allowed || !record) {
      res.status(decision.statusCode).send(decision.reason ?? "Not found");
      return;
    }

    const event = {
      code,
      clickedAt: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get("user-agent") ?? "",
      referer: req.get("referer") ?? ""
    };

    publishClick(event).catch((error) => {
      // eslint-disable-next-line no-console
      console.error("click event publish failed", error);
    });

    res.redirect(decision.statusCode, record.longUrl);
  } catch (error) {
    res.status(500).json({ error: "redirect_failed", detail: String(error) });
  }
});

async function bootstrap(): Promise<void> {
  await connectCache();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`redirect-service listening on ${config.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("failed to start redirect-service", error);
  process.exit(1);
});
