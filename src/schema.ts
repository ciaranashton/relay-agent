import { z } from "zod";

export const attachmentSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  content: z.union([z.string(), z.instanceof(Buffer)]),
  size: z.number(),
});

export const inboundMessageSchema = z.object({
  id: z.string(),
  channel: z.enum(["email", "whatsapp", "slack", "webhook"]),
  from: z.string(),
  to: z.string().optional(),
  subject: z.string().optional(),
  body: z.string(),
  attachments: z.array(attachmentSchema).optional(),
  metadata: z.record(z.unknown()),
  receivedAt: z.coerce.date(),
});

export const triageConfigSchema = z.object({
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
  alwaysTriage: z.array(z.string()).default([]),
  maxAutoReplies: z.number().positive().default(3),
  triageChannel: z.enum(["email", "slack", "webhook"]).default("email"),
  includeRecommendation: z.boolean().default(true),
});
