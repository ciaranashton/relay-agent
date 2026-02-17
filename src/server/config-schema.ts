import { z } from "zod";
import { triageConfigSchema } from "../package/schema.js";

const modelSchema = z.object({
  provider: z.string(),
  name: z.string(),
});

const inboundSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

const sourceSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

const actionSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

const serverSchema = z
  .object({
    port: z.coerce.number().default(3000),
  })
  .optional();

export const configSchema = z.object({
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  model: modelSchema,
  inbound: inboundSchema,
  sources: z.array(sourceSchema).optional().default([]),
  actions: z.array(actionSchema).optional().default([]),
  triage: triageConfigSchema.optional(),
  server: serverSchema,
});

export type RelayAgentConfig = z.infer<typeof configSchema>;
