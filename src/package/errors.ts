export class RelayAgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "RelayAgentError";
  }
}

export class WebhookVerificationError extends RelayAgentError {
  constructor(message: string, cause?: unknown) {
    super(message, "WEBHOOK_VERIFICATION_FAILED", cause);
    this.name = "WebhookVerificationError";
  }
}

export class SourceAdapterError extends RelayAgentError {
  constructor(
    message: string,
    public sourceName: string,
    cause?: unknown,
  ) {
    super(message, "SOURCE_ADAPTER_ERROR", cause);
    this.name = "SourceAdapterError";
  }
}

export class ActionError extends RelayAgentError {
  constructor(
    message: string,
    public actionName: string,
    cause?: unknown,
  ) {
    super(message, "ACTION_ERROR", cause);
    this.name = "ActionError";
  }
}

export class EngineError extends RelayAgentError {
  constructor(message: string, cause?: unknown) {
    super(message, "ENGINE_ERROR", cause);
    this.name = "EngineError";
  }
}
