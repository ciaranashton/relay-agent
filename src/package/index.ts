// Core
export { RelayAgent, createRelayAgent } from "./agent.js";
export { buildTools, runEngine } from "./engine.js";
export type { RunEngineOptions } from "./engine.js";
export { createLogger } from "./logger.js";
export type { Logger, LogLevel } from "./logger.js";
export {
  RelayAgentError,
  WebhookVerificationError,
  SourceAdapterError,
  ActionError,
  EngineError,
} from "./errors.js";
export {
  inboundMessageSchema,
  attachmentSchema,
  triageConfigSchema,
} from "./schema.js";
export type {
  InboundMessage,
  Attachment,
  SourceAdapter,
  Action,
  ActionContext,
  ActionResult,
  AgentConfig,
  TriageConfig,
  EngineResult,
  ToolCallRecord,
  InboundAdapter,
} from "./types.js";

// Adapters
export { createResendAdapter } from "./adapters/resend.js";
export type { ResendAdapterOptions } from "./adapters/resend.js";
export { createWebhookAdapter } from "./adapters/webhook.js";
export { createGoogleSheetsSource } from "./adapters/google-sheets.js";
export type { GoogleSheetsSourceOptions } from "./adapters/google-sheets.js";
export { createJsonFileSource } from "./adapters/json-file.js";
export type { JsonFileSourceOptions } from "./adapters/json-file.js";

// Actions
export { createReplyAction } from "./actions/reply.js";
export type { ReplyActionOptions } from "./actions/reply.js";
export { createTriageAction } from "./actions/triage.js";
export type { TriageActionOptions } from "./actions/triage.js";
export { createLogAction } from "./actions/log.js";
