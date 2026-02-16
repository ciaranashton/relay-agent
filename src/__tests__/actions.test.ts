import { describe, it, expect, vi } from "vitest";
import type { ActionContext, InboundMessage } from "../types.js";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({
        data: { id: "sent-email-123" },
        error: null,
      }),
    },
  })),
}));

import { createReplyAction } from "../actions/reply.js";
import { createTriageAction } from "../actions/triage.js";
import { createLogAction } from "../actions/log.js";

const testMessage: InboundMessage = {
  id: "msg-1",
  channel: "email",
  from: "user@example.com",
  subject: "Deliveroo receipt",
  body: "Order total: £18.50",
  metadata: {},
  receivedAt: new Date("2025-01-15T10:00:00Z"),
};

const testContext: ActionContext = {
  message: testMessage,
  agentName: "Expense Tracker",
};

describe("createReplyAction", () => {
  const action = createReplyAction({
    apiKey: "re_test_key",
    fromAddress: "agent@myapp.com",
  });

  it("has correct name and description", () => {
    expect(action.name).toBe("reply");
    expect(action.description).toContain("Reply");
  });

  it("sends an email via Resend", async () => {
    const result = await action.execute(
      {
        to: "user@example.com",
        subject: "Re: Deliveroo receipt",
        body: "Logged £18.50 from Deliveroo under Food.",
      },
      testContext,
    );

    expect(result.success).toBe(true);
    expect((result.data as any).emailId).toBe("sent-email-123");
  });
});

describe("createTriageAction", () => {
  const action = createTriageAction({
    apiKey: "re_test_key",
    fromAddress: "agent@myapp.com",
    triageRecipient: "admin@myapp.com",
  });

  it("has correct name and description", () => {
    expect(action.name).toBe("triage");
    expect(action.description).toContain("Forward");
  });

  it("sends a triage email with context", async () => {
    const result = await action.execute(
      {
        reason: "Amount exceeds £500 threshold",
        recommendation: "Categorise as Equipment",
        urgency: "high" as const,
      },
      testContext,
    );

    expect(result.success).toBe(true);
    expect((result.data as any).triaged).toBe(true);
  });
});

describe("createLogAction", () => {
  const action = createLogAction();

  it("has correct name and description", () => {
    expect(action.name).toBe("log");
    expect(action.description).toContain("Log");
  });

  it("logs a structured entry", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await action.execute(
      {
        level: "info" as const,
        message: "Expense logged",
        data: { vendor: "Deliveroo", amount: 18.5 },
      },
      testContext,
    );

    expect(result.success).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(logged.message).toBe("Expense logged");
    expect(logged.agent).toBe("Expense Tracker");

    consoleSpy.mockRestore();
  });
});
