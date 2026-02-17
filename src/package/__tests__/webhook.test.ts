import { describe, it, expect } from "vitest";
import { createWebhookAdapter } from "../adapters/webhook.js";

describe("createWebhookAdapter", () => {
  const adapter = createWebhookAdapter();

  it("has correct name", () => {
    expect(adapter.name).toBe("webhook");
  });

  it("parses a generic webhook payload", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "msg-456",
        from: "system@example.com",
        subject: "Alert",
        body: "Server CPU high",
        metadata: { severity: "warning" },
      }),
    });

    const message = await adapter.parseWebhook(request);

    expect(message.id).toBe("msg-456");
    expect(message.channel).toBe("webhook");
    expect(message.from).toBe("system@example.com");
    expect(message.subject).toBe("Alert");
    expect(message.body).toBe("Server CPU high");
    expect(message.metadata).toEqual({ severity: "warning" });
  });

  it("generates ID when not provided", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "test@example.com",
        body: "Hello",
      }),
    });

    const message = await adapter.parseWebhook(request);
    expect(message.id).toBeTruthy();
    expect(message.id.length).toBeGreaterThan(0);
  });
});
