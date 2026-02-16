#!/usr/bin/env node

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "./config-loader.js";
import { resolveModel } from "./resolve-model.js";
import {
  createInboundFromConfig,
  createSourceFromConfig,
  createActionFromConfig,
} from "./registry.js";
import { createRelayAgent } from "../agent.js";
import { startServer } from "./server.js";

const USAGE = `
relay-agent — Config-driven AI agent service

Usage:
  relay-agent start --config <path>   Start the agent server
  relay-agent --help                  Show this help message

Options:
  --config <path>   Path to relay-agent.config.json (required)
  --help            Show help
`.trim();

function parseArgs(argv: string[]): { command: string; configPath?: string } {
  const args = argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    return { command: "help" };
  }

  const command = args[0];
  if (command !== "start") {
    console.error(`Unknown command: "${command}"\n`);
    return { command: "help" };
  }

  const configIndex = args.indexOf("--config");
  if (configIndex === -1 || configIndex + 1 >= args.length) {
    console.error("Missing --config flag.\n");
    console.error("Usage: relay-agent start --config <path>\n");
    process.exit(1);
  }

  return { command: "start", configPath: args[configIndex + 1] };
}

async function main(): Promise<void> {
  // Load .env if present
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const dotenv = await import("dotenv");
    dotenv.config({ path: envPath });
  }

  const { command, configPath } = parseArgs(process.argv);

  if (command === "help") {
    console.log(USAGE);
    process.exit(0);
  }

  const resolvedPath = resolve(process.cwd(), configPath!);

  // Also load .env from the config file's directory if different from cwd
  const configDir = resolve(resolvedPath, "..");
  const configDirEnv = resolve(configDir, ".env");
  if (configDirEnv !== envPath && existsSync(configDirEnv)) {
    const dotenv = await import("dotenv");
    dotenv.config({ path: configDirEnv });
  }

  const config = loadConfig(resolvedPath);

  const model = await resolveModel(config.model);

  const inboundAdapter = createInboundFromConfig(config.inbound as Record<string, unknown>);

  const sources = config.sources.map((s) =>
    createSourceFromConfig(s as Record<string, unknown>),
  );

  const actions = config.actions.map((a) =>
    createActionFromConfig(a as Record<string, unknown>),
  );

  const agent = createRelayAgent({
    name: config.name,
    description: config.description,
    instructions: config.instructions,
    model,
    sources,
    actions,
    triage: config.triage,
  });

  const port = config.server?.port ?? 3000;

  startServer({ agent, inboundAdapter, port });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
