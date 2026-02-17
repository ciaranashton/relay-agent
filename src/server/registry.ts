import { createResendAdapter } from "../package/adapters/resend.js";
import { createWebhookAdapter } from "../package/adapters/webhook.js";
import { createGoogleSheetsSource } from "../package/adapters/google-sheets.js";
import { createJsonFileSource } from "../package/adapters/json-file.js";
import { createReplyAction } from "../package/actions/reply.js";
import { createTriageAction } from "../package/actions/triage.js";
import { createLogAction } from "../package/actions/log.js";
import type { InboundAdapter, SourceAdapter, Action } from "../package/types.js";

type Factory<T> = (options: Record<string, unknown>) => T;

const inboundAdapters: Record<string, Factory<InboundAdapter>> = {
  resend: (opts) => createResendAdapter(opts as Parameters<typeof createResendAdapter>[0]),
  webhook: () => createWebhookAdapter(),
};

const sourceAdapters: Record<string, Factory<SourceAdapter>> = {
  "google-sheets": (opts) =>
    createGoogleSheetsSource(opts as Parameters<typeof createGoogleSheetsSource>[0]),
  "json-file": (opts) =>
    createJsonFileSource(opts as Parameters<typeof createJsonFileSource>[0]),
};

const actions: Record<string, Factory<Action>> = {
  reply: (opts) => createReplyAction(opts as Parameters<typeof createReplyAction>[0]),
  triage: (opts) => createTriageAction(opts as Parameters<typeof createTriageAction>[0]),
  log: () => createLogAction(),
};

function stripType(config: Record<string, unknown>): Record<string, unknown> {
  const { type: _, ...rest } = config;
  return rest;
}

export function createInboundFromConfig(config: Record<string, unknown>): InboundAdapter {
  const type = config.type as string;
  const factory = inboundAdapters[type];
  if (!factory) {
    throw new Error(
      `Unknown inbound adapter type: "${type}". Available: ${Object.keys(inboundAdapters).join(", ")}`,
    );
  }
  return factory(stripType(config));
}

export function createSourceFromConfig(config: Record<string, unknown>): SourceAdapter {
  const type = config.type as string;
  const factory = sourceAdapters[type];
  if (!factory) {
    throw new Error(
      `Unknown source type: "${type}". Available: ${Object.keys(sourceAdapters).join(", ")}`,
    );
  }
  return factory(stripType(config));
}

export function createActionFromConfig(config: Record<string, unknown>): Action {
  const type = config.type as string;
  const factory = actions[type];
  if (!factory) {
    throw new Error(
      `Unknown action type: "${type}". Available: ${Object.keys(actions).join(", ")}`,
    );
  }
  return factory(stripType(config));
}
