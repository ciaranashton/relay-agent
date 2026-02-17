import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { buildTools, runEngine } from "../engine.js";
import type {
  SourceAdapter,
  Action,
  ActionContext,
  InboundMessage,
} from "../types.js";
import { createLogger } from "../logger.js";

const logger = createLogger("test", "error");

const testMessage: InboundMessage = {
  id: "msg-1",
  channel: "email",
  from: "user@example.com",
  subject: "Test receipt",
  body: "Deliveroo order £18.50",
  metadata: {},
  receivedAt: new Date("2025-01-15T10:00:00Z"),
};

function makeSource(overrides?: Partial<SourceAdapter>): SourceAdapter {
  return {
    name: "expenses",
    description: "Expense tracking spreadsheet",
    querySchema: z.object({ tab: z.string(), filter: z.string().optional() }),
    writeSchema: z.object({
      tab: z.string(),
      row: z.record(z.string()),
    }),
    query: vi.fn().mockResolvedValue([{ vendor: "Deliveroo", amount: 18.5 }]),
    write: vi.fn().mockResolvedValue({ success: true, row: 42 }),
    ...overrides,
  };
}

function makeAction(overrides?: Partial<Action>): Action {
  return {
    name: "reply",
    description: "Reply to the sender via email",
    schema: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
    execute: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

describe("buildTools", () => {
  it("creates query tools from sources", () => {
    const source = makeSource();
    const tools = buildTools(
      [source],
      [],
      { message: testMessage, agentName: "test" },
      logger,
    );
    expect(tools).toHaveProperty("query_expenses");
    expect(tools.query_expenses.description).toContain("expenses");
  });

  it("creates write tools from sources with write support", () => {
    const source = makeSource();
    const tools = buildTools(
      [source],
      [],
      { message: testMessage, agentName: "test" },
      logger,
    );
    expect(tools).toHaveProperty("write_expenses");
  });

  it("skips write tool when source has no write", () => {
    const source = makeSource({ write: undefined, writeSchema: undefined });
    const tools = buildTools(
      [source],
      [],
      { message: testMessage, agentName: "test" },
      logger,
    );
    expect(tools).not.toHaveProperty("write_expenses");
  });

  it("creates action tools", () => {
    const action = makeAction();
    const tools = buildTools(
      [],
      [action],
      { message: testMessage, agentName: "test" },
      logger,
    );
    expect(tools).toHaveProperty("action_reply");
    expect(tools.action_reply.description).toBe(
      "Reply to the sender via email",
    );
  });

  it("combines sources and actions", () => {
    const source = makeSource();
    const action = makeAction();
    const tools = buildTools(
      [source],
      [action],
      { message: testMessage, agentName: "test" },
      logger,
    );
    expect(Object.keys(tools)).toEqual([
      "query_expenses",
      "write_expenses",
      "action_reply",
    ]);
  });
});

describe("buildTools execute", () => {
  it("calls source.query when query tool is executed", async () => {
    const source = makeSource();
    const tools = buildTools(
      [source],
      [],
      { message: testMessage, agentName: "test" },
      logger,
    );
    const result = await tools.query_expenses.execute!(
      { tab: "Expenses" },
      { abortSignal: new AbortController().signal, toolCallId: "tc-1", messages: [] },
    );
    expect(source.query).toHaveBeenCalledWith({ tab: "Expenses" });
    expect(result).toEqual([{ vendor: "Deliveroo", amount: 18.5 }]);
  });

  it("calls source.write when write tool is executed", async () => {
    const source = makeSource();
    const tools = buildTools(
      [source],
      [],
      { message: testMessage, agentName: "test" },
      logger,
    );
    const result = await tools.write_expenses.execute!(
      { tab: "Expenses", row: { vendor: "Deliveroo" } },
      { abortSignal: new AbortController().signal, toolCallId: "tc-2", messages: [] },
    );
    expect(source.write).toHaveBeenCalled();
    expect(result).toEqual({ success: true, row: 42 });
  });

  it("calls action.execute with context", async () => {
    const action = makeAction();
    const context: ActionContext = {
      message: testMessage,
      agentName: "test",
    };
    const tools = buildTools([], [action], context, logger);
    await tools.action_reply.execute!(
      { to: "user@example.com", subject: "Re: Test", body: "Done" },
      { abortSignal: new AbortController().signal, toolCallId: "tc-3", messages: [] },
    );
    expect(action.execute).toHaveBeenCalledWith(
      { to: "user@example.com", subject: "Re: Test", body: "Done" },
      context,
    );
  });
});

describe("runEngine", () => {
  it("passes tools and system prompt to generateText", async () => {
    const mockModel = {
      specificationVersion: "v1" as const,
      provider: "test",
      modelId: "test-model",
      defaultObjectGenerationMode: undefined,
      doGenerate: vi.fn().mockResolvedValue({
        text: "Logged your expense.",
        toolCalls: [],
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5 },
        rawCall: { rawPrompt: "", rawSettings: {} },
      }),
      doStream: vi.fn(),
    };

    const result = await runEngine({
      model: mockModel as any,
      agentName: "Expense Tracker",
      description: "Tracks expenses",
      instructions: "Extract amounts from receipts",
      sources: [],
      actions: [],
      message: testMessage,
      logger,
    });

    expect(result.text).toBe("Logged your expense.");
    expect(result.steps).toBeGreaterThanOrEqual(1);
    expect(result.toolCalls).toEqual([]);
  });
});
