import cors from "cors";
import express from "express";
import { config } from "./config";
import { authMiddleware } from "./lib/auth";
import { analyticsRouter } from "./routes/analytics";
import { urlsRouter } from "./routes/urls";
import { UrlRepository } from "./lib/spanner";

export function createApp(repository = new UrlRepository()): express.Express {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (config.allowedOrigins.includes("*") || config.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      }
    })
  );

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, service: "api-service" });
  });

  app.use("/v1/urls", authMiddleware, urlsRouter(repository));
  app.use("/v1/analytics", authMiddleware, analyticsRouter(repository));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`api-service listening on ${config.port}`);
  });
}
