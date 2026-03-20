import { PubSub } from "@google-cloud/pubsub";
import { config } from "../config";

const pubSub = new PubSub({ projectId: config.projectId });

export async function publishClick(payload: Record<string, unknown>): Promise<void> {
  await pubSub.topic(config.pubsubTopicClicks).publishMessage({
    data: Buffer.from(JSON.stringify(payload), "utf8")
  });
}
