import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { RelayAgent } from "../package/agent.js";
import type { InboundAdapter } from "../package/types.js";

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
    // Read body once — Node.js streams can't be cloned reliably
    const bodyText = await c.req.text();
    const headers = Object.fromEntries(c.req.raw.headers.entries());

    function makeRequest(): Request {
      return new Request(c.req.url, {
        method: "POST",
        headers,
        body: bodyText,
      });
    }

    try {
      if (inboundAdapter.verifySignature) {
        await inboundAdapter.verifySignature(makeRequest());
      }
    } catch {
      return c.json({ error: "Invalid signature" }, 401);
    }

    const message = await inboundAdapter.parseWebhook(makeRequest());

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
