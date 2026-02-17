import type { Action, ActionResult, ActionContext } from "../types.js";
import { Resend } from "resend";
import { z } from "zod";

export interface ReplyActionOptions {
  apiKey: string;
  fromAddress: string;
}

const replySchema = z.object({
  to: z.string().describe("Email address to reply to"),
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Email body text"),
});

export function createReplyAction(options: ReplyActionOptions): Action {
  const resend = new Resend(options.apiKey);

  return {
    name: "reply",
    description:
      "Reply to the sender via email. Use this to send a response back to the person who sent the message.",
    schema: replySchema,

    async execute(
      params: z.infer<typeof replySchema>,
      _context: ActionContext,
    ): Promise<ActionResult> {
      const { data, error } = await resend.emails.send({
        from: options.fromAddress,
        to: params.to,
        subject: params.subject,
        text: params.body,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: { emailId: data?.id } };
    },
  };
}
