import { describe, it, expect, vi } from "vitest";
import {
  createInboundFromConfig,
  createSourceFromConfig,
  createActionFromConfig,
} from "../registry.js";

// Mock the adapters/actions to avoid real dependencies
vi.mock("../../package/adapters/resend.js", () => ({
  createResendAdapter: vi.fn((opts) => ({
    name: "resend",
    opts,
    parseWebhook: vi.fn(),
  })),
}));

vi.mock("../../package/adapters/webhook.js", () => ({
  createWebhookAdapter: vi.fn(() => ({
    name: "webhook",
    parseWebhook: vi.fn(),
  })),
}));

vi.mock("../../package/adapters/google-sheets.js", () => ({
  createGoogleSheetsSource: vi.fn((opts) => ({
    name: "google-sheets",
    opts,
    query: vi.fn(),
  })),
}));

vi.mock("../../package/actions/reply.js", () => ({
  createReplyAction: vi.fn((opts) => ({
    name: "reply",
    opts,
    execute: vi.fn(),
  })),
}));

vi.mock("../../package/actions/triage.js", () => ({
  createTriageAction: vi.fn((opts) => ({
    name: "triage",
    opts,
    execute: vi.fn(),
  })),
}));

vi.mock("../../package/actions/log.js", () => ({
  createLogAction: vi.fn(() => ({
    name: "log",
    execute: vi.fn(),
  })),
}));

describe("createInboundFromConfig", () => {
  it("creates a resend adapter", () => {
    const adapter = createInboundFromConfig({
      type: "resend",
      webhookSecret: "secret",
      apiKey: "key",
    });
    expect(adapter.name).toBe("resend");
  });

  it("creates a webhook adapter", () => {
    const adapter = createInboundFromConfig({ type: "webhook" });
    expect(adapter.name).toBe("webhook");
  });

  it("strips the type field before passing to factory", async () => {
    const { createResendAdapter } = vi.mocked(
      await import("../../package/adapters/resend.js"),
    );
    createInboundFromConfig({
      type: "resend",
      webhookSecret: "s",
      apiKey: "k",
    });
    expect(createResendAdapter).toHaveBeenCalledWith({
      webhookSecret: "s",
      apiKey: "k",
    });
  });

  it("throws on unknown type", () => {
    expect(() => createInboundFromConfig({ type: "unknown" })).toThrow(
      'Unknown inbound adapter type: "unknown"',
    );
  });
});

describe("createSourceFromConfig", () => {
  it("creates a google-sheets source", () => {
    const source = createSourceFromConfig({
      type: "google-sheets",
      sheetId: "123",
      credentials: { clientEmail: "a", privateKey: "b" },
      tabs: {},
    });
    expect(source.name).toBe("google-sheets");
  });

  it("throws on unknown type", () => {
    expect(() => createSourceFromConfig({ type: "nope" })).toThrow(
      'Unknown source type: "nope"',
    );
  });
});

describe("createActionFromConfig", () => {
  it("creates a reply action", () => {
    const action = createActionFromConfig({
      type: "reply",
      apiKey: "k",
      fromAddress: "a@b.com",
    });
    expect(action.name).toBe("reply");
  });

  it("creates a triage action", () => {
    const action = createActionFromConfig({
      type: "triage",
      apiKey: "k",
      fromAddress: "a@b.com",
      triageRecipient: "t@b.com",
    });
    expect(action.name).toBe("triage");
  });

  it("creates a log action", () => {
    const action = createActionFromConfig({ type: "log" });
    expect(action.name).toBe("log");
  });

  it("throws on unknown type", () => {
    expect(() => createActionFromConfig({ type: "bad" })).toThrow(
      'Unknown action type: "bad"',
    );
  });
});
