import { PubSub } from "@google-cloud/pubsub";
import { config } from "../config";

const pubSub = new PubSub({ projectId: config.projectId });

export async function publishEvent(payload: Record<string, unknown>): Promise<void> {
  const topic = pubSub.topic(config.pubsubTopicClicks);
  await topic.publishMessage({
    data: Buffer.from(JSON.stringify(payload), "utf8")
  });
}
