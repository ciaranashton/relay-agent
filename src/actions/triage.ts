import type { Action, ActionResult, ActionContext } from "../types.js";
import { Resend } from "resend";
import { z } from "zod";

export interface TriageActionOptions {
  apiKey: string;
  fromAddress: string;
  triageRecipient: string;
}

const triageSchema = z.object({
  reason: z.string().describe("Why this message is being triaged to a human"),
  recommendation: z
    .string()
    .optional()
    .describe("Recommended response for the human to review and send"),
  urgency: z
    .enum(["low", "medium", "high"])
    .describe("Urgency level of the triaged item"),
});

export function createTriageAction(options: TriageActionOptions): Action {
  const resend = new Resend(options.apiKey);

  return {
    name: "triage",
    description:
      "Forward a message to a human for review. Use this when you are unsure, when the message contains sensitive keywords, or when confidence is low.",
    schema: triageSchema,

    async execute(
      params: z.infer<typeof triageSchema>,
      context: ActionContext,
    ): Promise<ActionResult> {
      const { message } = context;
      const urgencyEmoji =
        params.urgency === "high"
          ? "[URGENT]"
          : params.urgency === "medium"
            ? "[REVIEW]"
            : "[FYI]";

      const body = `${urgencyEmoji} Triage from ${context.agentName}

Original message from: ${message.from}
Subject: ${message.subject ?? "(no subject)"}
Received: ${message.receivedAt.toISOString()}

--- Original Message ---
${message.body}

--- Agent Analysis ---
Reason for triage: ${params.reason}
${params.recommendation ? `\nRecommended response:\n${params.recommendation}` : ""}`;

      const { data, error } = await resend.emails.send({
        from: options.fromAddress,
        to: options.triageRecipient,
        subject: `${urgencyEmoji} Triage: ${message.subject ?? "No subject"}`,
        text: body,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: { emailId: data?.id, triaged: true } };
    },
  };
}
