import type { Action, ActionResult, ActionContext } from "../types.js";
import { z } from "zod";

const logSchema = z.object({
  level: z
    .enum(["info", "warn", "error"])
    .describe("Log level for the entry"),
  message: z.string().describe("Log message to record"),
  data: z
    .record(z.unknown())
    .optional()
    .describe("Additional structured data to include in the log"),
});

export function createLogAction(): Action {
  return {
    name: "log",
    description:
      "Log a structured message for audit/debugging purposes. Use this to record notable events during processing.",
    schema: logSchema,

    async execute(
      params: z.infer<typeof logSchema>,
      context: ActionContext,
    ): Promise<ActionResult> {
      const entry = {
        timestamp: new Date().toISOString(),
        agent: context.agentName,
        messageId: context.message.id,
        level: params.level,
        message: params.message,
        ...params.data,
      };

      if (params.level === "error") {
        console.error(JSON.stringify(entry));
      } else if (params.level === "warn") {
        console.warn(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(entry));
      }

      return { success: true, data: entry };
    },
  };
}
