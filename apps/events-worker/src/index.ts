import express from "express";
import { config } from "./config";
import { writeClick } from "./lib/bigquery";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, service: "events-worker" });
});

app.post("/pubsub/push", async (req, res) => {
  const envelope = req.body as {
    message?: {
      data?: string;
      messageId?: string;
    };
    subscription?: string;
  };

  if (!envelope.message?.data) {
    res.status(400).json({ error: "Missing Pub/Sub message data" });
    return;
  }

  try {
    const payload = JSON.parse(Buffer.from(envelope.message.data, "base64").toString("utf8")) as {
      code: string;
      clickedAt: string;
      ip: string;
      userAgent: string;
      referer: string;
    };

    if (!payload.code) {
      res.status(400).json({ error: "Missing code in payload" });
      return;
    }

    await writeClick(payload);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "failed_to_process_message", detail: String(error) });
  }
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`events-worker listening on ${config.port}`);
});
