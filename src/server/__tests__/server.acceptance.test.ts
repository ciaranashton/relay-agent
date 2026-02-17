import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve } from "node:path";
import { createApp } from "../server.js";
import { loadConfig } from "../config-loader.js";
import { createInboundFromConfig, createActionFromConfig } from "../registry.js";
import { createRelayAgent } from "../../package/agent.js";
import type { LanguageModel } from "ai";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

/** Stub model — the webhook returns before agent.process() runs, so this never fires in tests */
const stubModel = { modelId: "stub" } as unknown as LanguageModel;

function buildAppFromConfig(configPath: string) {
  const config = loadConfig(configPath);
  const inboundAdapter = createInboundFromConfig(
    config.inbound as Record<string, unknown>,
  );
  const actions = config.actions.map((a) =>
    createActionFromConfig(a as Record<string, unknown>),
  );
  const agent = createRelayAgent({
    name: config.name,
    description: config.description,
    instructions: config.instructions,
    model: stubModel,
    sources: [],
    actions,
    triage: config.triage,
  });
  return { app: createApp({ agent, inboundAdapter }), agent, inboundAdapter };
}

describe("server acceptance", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const configPath = resolve(FIXTURES, "minimal.config.json");
    ({ app } = buildAppFromConfig(configPath));
  });

  describe("GET /health", () => {
    it("returns 200 with agent name", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ok", agent: "Test Agent" });
    });
  });

  describe("POST /webhook/webhook", () => {
    it("accepts a valid webhook payload and returns messageId", async () => {
      const res = await app.request("/webhook/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "msg-123",
          from: "user@example.com",
          subject: "Hello",
          body: "Test message body",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
      expect(body.messageId).toBe("msg-123");
    });

    it("auto-generates messageId when not provided", async () => {
      const res = await app.request("/webhook/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "user@example.com",
          body: "No id provided",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
      expect(body.messageId).toBeTruthy();
      expect(body.messageId).not.toBe("msg-123"); // it's a UUID
    });

    it("returns 404 for wrong webhook path", async () => {
      const res = await app.request("/webhook/wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "a", body: "b" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("resend adapter with signature verification", () => {
    it("rejects unsigned requests with 401", async () => {
      vi.stubEnv("WEBHOOK_SECRET", "whsec_test");
      vi.stubEnv("API_KEY", "re_test");
      vi.stubEnv("AGENT_NAME", "Signed Agent");
      vi.stubEnv("TEST_PORT", "0");

      const configPath = resolve(FIXTURES, "with-env-vars.config.json");
      const { app: signedApp } = buildAppFromConfig(configPath);

      const res = await signedApp.request("/webhook/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Invalid signature");

      vi.unstubAllEnvs();
    });
  });

  describe("unknown routes", () => {
    it("returns 404 for GET /unknown", async () => {
      const res = await app.request("/unknown");
      expect(res.status).toBe(404);
    });

    it("returns 404 for POST /", async () => {
      const res = await app.request("/", { method: "POST" });
      expect(res.status).toBe(404);
    });
  });
});
