import type { InboundMessage, InboundAdapter } from "../types.js";
import { z } from "zod";

const genericWebhookSchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  subject: z.string().optional(),
  body: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export function createWebhookAdapter(): InboundAdapter {
  return {
    name: "webhook",

    async parseWebhook(request: Request): Promise<InboundMessage> {
      const rawBody = await request.json();
      const payload = genericWebhookSchema.parse(rawBody);

      return {
        id: payload.id ?? crypto.randomUUID(),
        channel: "webhook",
        from: payload.from,
        subject: payload.subject,
        body: payload.body,
        metadata: payload.metadata ?? {},
        receivedAt: new Date(),
      };
    },
  };
}
