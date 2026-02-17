import type { AgentConfig, EngineResult, InboundMessage } from "./types.js";
import { runEngine } from "./engine.js";
import { createLogger, type Logger, type LogLevel } from "./logger.js";

export class RelayAgent {
  private config: AgentConfig;
  private logger: Logger;

  constructor(config: AgentConfig, logLevel?: LogLevel) {
    this.config = config;
    this.logger = createLogger(config.name, logLevel);
  }

  async process(message: InboundMessage): Promise<EngineResult> {
    this.logger.info("Processing message", {
      messageId: message.id,
      channel: message.channel,
      from: message.from,
    });

    const result = await runEngine({
      model: this.config.model,
      agentName: this.config.name,
      description: this.config.description,
      instructions: this.config.instructions,
      sources: this.config.sources,
      actions: this.config.actions,
      message,
      triage: this.config.triage,
      logger: this.logger,
    });

    this.logger.info("Message processed", {
      messageId: message.id,
      steps: result.steps,
      toolCalls: result.toolCalls.length,
    });

    return result;
  }

  get name(): string {
    return this.config.name;
  }
}

export function createRelayAgent(
  config: AgentConfig,
  logLevel?: LogLevel,
): RelayAgent {
  return new RelayAgent(config, logLevel);
}
