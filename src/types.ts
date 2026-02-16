import type { LanguageModel } from "ai";
import type { z, ZodTypeAny } from "zod";

export interface Attachment {
  filename: string;
  contentType: string;
  content: string | Buffer;
  size: number;
}

export interface InboundMessage {
  id: string;
  channel: "email" | "whatsapp" | "slack" | "webhook";
  from: string;
  to?: string;
  subject?: string;
  body: string;
  attachments?: Attachment[];
  metadata: Record<string, unknown>;
  receivedAt: Date;
}

export interface SourceAdapter<
  TQueryParams extends ZodTypeAny = ZodTypeAny,
  TWriteParams extends ZodTypeAny = ZodTypeAny,
> {
  name: string;
  description: string;
  queryDescription?: string;
  writeDescription?: string;
  querySchema: TQueryParams;
  writeSchema?: TWriteParams;
  query(params: z.infer<TQueryParams>): Promise<unknown>;
  write?(params: z.infer<TWriteParams>): Promise<unknown>;
}

export interface ActionContext {
  message: InboundMessage;
  agentName: string;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Action<TParams extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  schema: TParams;
  execute(
    params: z.infer<TParams>,
    context: ActionContext,
  ): Promise<ActionResult>;
}

export interface TriageConfig {
  confidenceThreshold: number;
  alwaysTriage: string[];
  maxAutoReplies: number;
  triageChannel: "email" | "slack" | "webhook";
  includeRecommendation: boolean;
}

export interface AgentConfig {
  name: string;
  description: string;
  instructions: string;
  model: LanguageModel;
  sources: SourceAdapter[];
  actions: Action[];
  triage?: TriageConfig;
}

export interface EngineResult {
  text: string;
  toolCalls: ToolCallRecord[];
  steps: number;
}

export interface ToolCallRecord {
  toolName: string;
  args: unknown;
  result: unknown;
}

export interface InboundAdapter {
  name: string;
  parseWebhook(request: Request): Promise<InboundMessage>;
  verifySignature?(request: Request): Promise<boolean>;
}
