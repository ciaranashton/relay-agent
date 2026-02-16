import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { RelayAgent } from "../agent.js";
import type { InboundAdapter } from "../types.js";

export interface ServerOptions {
  agent: RelayAgent;
  inboundAdapter: InboundAdapter;
  port: number;
}

export function createApp({
  agent,
  inboundAdapter,
}: Pick<ServerOptions, "agent" | "inboundAdapter">): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok", agent: agent.name }));

  app.post(`/webhook/${inboundAdapter.name}`, async (c) => {
    try {
      if (inboundAdapter.verifySignature) {
        await inboundAdapter.verifySignature(c.req.raw.clone());
      }
    } catch {
      return c.json({ error: "Invalid signature" }, 401);
    }

    const message = await inboundAdapter.parseWebhook(c.req.raw);

    // Process async — return 200 immediately
    agent.process(message).catch((error) => {
      console.error("Agent processing failed:", error);
    });

    return c.json({ received: true, messageId: message.id });
  });

  return app;
}

export function startServer(options: ServerOptions): void {
  const app = createApp(options);

  serve({ fetch: app.fetch, port: options.port }, (info) => {
    console.log(
      `${options.agent.name} running on http://localhost:${info.port}`,
    );
    console.log(
      `Webhook endpoint: POST /webhook/${options.inboundAdapter.name}`,
    );
    console.log(`Health check:     GET /health`);
  });
}
