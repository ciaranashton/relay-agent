import { generateText, tool, type LanguageModel, type Tool } from "ai";
import type {
  Action,
  ActionContext,
  EngineResult,
  InboundMessage,
  SourceAdapter,
  ToolCallRecord,
  TriageConfig,
} from "./types.js";
import { SourceAdapterError, ActionError, EngineError } from "./errors.js";
import type { Logger } from "./logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

export function buildTools(
  sources: SourceAdapter[],
  actions: Action[],
  context: ActionContext,
  logger: Logger,
): Record<string, AnyTool> {
  const tools: Record<string, AnyTool> = {};

  for (const source of sources) {
    tools[`query_${source.name}`] = tool({
      description:
        source.queryDescription ??
        `Query data from ${source.name}: ${source.description}`,
      parameters: source.querySchema,
      execute: async (params) => {
        logger.info(`Querying source: ${source.name}`, { params });
        try {
          const result = await source.query(params);
          logger.debug(`Source query result: ${source.name}`, {
            result: result as Record<string, unknown>,
          });
          return result;
        } catch (error) {
          logger.error(`Source query failed: ${source.name}`, {
            error: String(error),
          });
          throw new SourceAdapterError(
            `Query failed for ${source.name}: ${error}`,
            source.name,
            error,
          );
        }
      },
    });

    if (source.write && source.writeSchema) {
      tools[`write_${source.name}`] = tool({
        description:
          source.writeDescription ??
          `Write data to ${source.name}: ${source.description}`,
        parameters: source.writeSchema,
        execute: async (params) => {
          logger.info(`Writing to source: ${source.name}`, { params });
          try {
            const result = await source.write!(params);
            logger.debug(`Source write result: ${source.name}`, {
              result: result as Record<string, unknown>,
            });
            return result;
          } catch (error) {
            logger.error(`Source write failed: ${source.name}`, {
              error: String(error),
            });
            throw new SourceAdapterError(
              `Write failed for ${source.name}: ${error}`,
              source.name,
              error,
            );
          }
        },
      });
    }
  }

  for (const action of actions) {
    tools[`action_${action.name}`] = tool({
      description: action.description,
      parameters: action.schema,
      execute: async (params) => {
        logger.info(`Executing action: ${action.name}`, { params });
        try {
          const result = await action.execute(params, context);
          logger.debug(`Action result: ${action.name}`, {
            result: result as unknown as Record<string, unknown>,
          });
          return result;
        } catch (error) {
          logger.error(`Action failed: ${action.name}`, {
            error: String(error),
          });
          throw new ActionError(
            `Action failed for ${action.name}: ${error}`,
            action.name,
            error,
          );
        }
      },
    });
  }

  return tools;
}

function buildSystemPrompt(
  agentName: string,
  description: string,
  instructions: string,
  triage?: TriageConfig,
): string {
  let prompt = `You are ${agentName}. ${description}

## Instructions
${instructions}

## Guidelines
- Use the available tools to query data, write data, and take actions.
- Always verify data before writing (e.g., check for duplicates).
- Provide clear, concise responses.
- If you're unsure, use the triage action to escalate to a human.`;

  if (triage) {
    prompt += `

## Triage Rules
- If your confidence in handling this message is below ${triage.confidenceThreshold * 100}%, use the triage action.
- ALWAYS triage messages containing these keywords: ${triage.alwaysTriage.join(", ")}.
- Maximum ${triage.maxAutoReplies} auto-replies per conversation before requiring human review.
${triage.includeRecommendation ? "- When triaging, include your recommended response for the human to review." : ""}`;
  }

  return prompt;
}

export interface RunEngineOptions {
  model: LanguageModel;
  agentName: string;
  description: string;
  instructions: string;
  sources: SourceAdapter[];
  actions: Action[];
  message: InboundMessage;
  triage?: TriageConfig;
  logger: Logger;
  maxSteps?: number;
}

export async function runEngine(
  options: RunEngineOptions,
): Promise<EngineResult> {
  const {
    model,
    agentName,
    description,
    instructions,
    sources,
    actions,
    message,
    triage,
    logger,
    maxSteps = 10,
  } = options;

  const context: ActionContext = {
    message,
    agentName,
  };

  const tools = buildTools(sources, actions, context, logger);
  const systemPrompt = buildSystemPrompt(
    agentName,
    description,
    instructions,
    triage,
  );

  const userMessage = formatInboundMessage(message);

  logger.info("Running engine", {
    messageId: message.id,
    toolCount: Object.keys(tools).length,
  });

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools,
      maxSteps,
    });

    const toolCalls: ToolCallRecord[] = [];
    for (const step of result.steps) {
      const calls = step.toolCalls as Array<{
        toolCallId: string;
        toolName: string;
        args: unknown;
      }>;
      const results = step.toolResults as Array<{
        toolCallId: string;
        result: unknown;
      }>;
      for (const tc of calls) {
        toolCalls.push({
          toolName: tc.toolName,
          args: tc.args,
          result: results.find((r) => r.toolCallId === tc.toolCallId)?.result,
        });
      }
    }

    logger.info("Engine completed", {
      messageId: message.id,
      steps: result.steps.length,
      toolCallCount: toolCalls.length,
    });

    return {
      text: result.text,
      toolCalls,
      steps: result.steps.length,
    };
  } catch (error) {
    logger.error("Engine failed", {
      messageId: message.id,
      error: String(error),
    });
    throw new EngineError(`Engine failed: ${error}`, error);
  }
}

function formatInboundMessage(message: InboundMessage): string {
  const parts: string[] = [];

  parts.push(`Channel: ${message.channel}`);
  parts.push(`From: ${message.from}`);
  if (message.to) parts.push(`To: ${message.to}`);
  if (message.subject) parts.push(`Subject: ${message.subject}`);
  parts.push(`Date: ${message.receivedAt.toISOString()}`);
  parts.push("");
  parts.push(message.body);

  if (message.attachments?.length) {
    parts.push("");
    parts.push(
      `Attachments: ${message.attachments.map((a) => `${a.filename} (${a.contentType})`).join(", ")}`,
    );
  }

  return parts.join("\n");
}
