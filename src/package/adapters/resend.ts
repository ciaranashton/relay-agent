import type { InboundMessage, InboundAdapter } from "../types.js";
import { WebhookVerificationError } from "../errors.js";
import { Webhook } from "svix";
import { z } from "zod";

const resendWebhookPayloadSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    subject: z.string(),
    created_at: z.string(),
  }),
});

export interface ResendAdapterOptions {
  webhookSecret: string;
  apiKey: string;
}

async function fetchEmailBody(
  emailId: string,
  apiKey: string,
): Promise<{ html: string; text: string }> {
  const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch email body: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { html?: string; text?: string };
  return {
    html: data.html ?? "",
    text: data.text ?? "",
  };
}

export function createResendAdapter(
  options: ResendAdapterOptions,
): InboundAdapter {
  const wh = new Webhook(options.webhookSecret);

  return {
    name: "resend",

    async verifySignature(request: Request): Promise<boolean> {
      try {
        const body = await request.clone().text();
        const svixId = request.headers.get("svix-id") ?? "";
        const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
        const svixSignature = request.headers.get("svix-signature") ?? "";

        wh.verify(body, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
        return true;
      } catch (error) {
        throw new WebhookVerificationError(
          `Resend webhook verification failed: ${error}`,
          error,
        );
      }
    },

    async parseWebhook(request: Request): Promise<InboundMessage> {
      const rawBody = await request.json();
      const payload = resendWebhookPayloadSchema.parse(rawBody);

      const emailBody = await fetchEmailBody(
        payload.data.email_id,
        options.apiKey,
      );

      return {
        id: payload.data.email_id,
        channel: "email",
        from: payload.data.from,
        to: payload.data.to[0],
        subject: payload.data.subject,
        body: emailBody.text || emailBody.html,
        metadata: {
          emailId: payload.data.email_id,
          webhookType: payload.type,
        },
        receivedAt: new Date(payload.data.created_at),
      };
    },
  };
}
