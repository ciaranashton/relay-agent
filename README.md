# Relay Agent

A framework for building AI agents that sit between inbound messages and your APIs. Define your agent in a JSON config file, run it with one command.

```
Inbound Message ──▶ Relay Agent ──▶ Sources (query/write data)
   (email,                │
    webhook)              └──▶ Actions (reply, triage, log)
```

## Quick Start

```bash
npm install relay-agent @ai-sdk/anthropic
```

Create `relay-agent.config.json`:

```json
{
  "name": "My Agent",
  "description": "Handles incoming messages",
  "instructions": "You are a helpful assistant...",
  "model": {
    "provider": "anthropic",
    "name": "claude-sonnet-4-20250514"
  },
  "inbound": { "type": "webhook" },
  "actions": [{ "type": "log" }]
}
```

Run it:

```bash
npx relay-agent start --config relay-agent.config.json
```

```
My Agent running on http://localhost:3000
Webhook endpoint: POST /webhook/webhook
Health check:     GET /health
```

## Config File

The config file defines everything about your agent. Use `$VAR` to reference environment variables — they're resolved from `.env` or the environment at startup.

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent name, used in logs and the health endpoint |
| `description` | Yes | What the agent does — becomes part of the system prompt |
| `instructions` | Yes | Domain-specific behaviour rules for the LLM |
| `model` | Yes | `{ provider, name }` — which LLM to use |
| `inbound` | Yes | `{ type, ...options }` — how messages arrive |
| `sources` | No | Array of `{ type, ...options }` — data sources the agent can query/write |
| `actions` | No | Array of `{ type, ...options }` — things the agent can do |
| `triage` | No | Rules for when to escalate to a human |
| `server` | No | `{ port }` — defaults to 3000 |

### Environment Variable Substitution

Any string value starting with `$` is replaced with the corresponding environment variable. A `.env` file is loaded automatically if present.

```json
{
  "inbound": {
    "type": "resend",
    "webhookSecret": "$RESEND_WEBHOOK_SECRET",
    "apiKey": "$RESEND_API_KEY"
  }
}
```

### Model Providers

The `provider` field determines which `@ai-sdk/*` package is dynamically imported. Install the one you need:

| Provider | Package | Example model name |
|----------|---------|-------------------|
| `anthropic` | `@ai-sdk/anthropic` | `claude-sonnet-4-20250514` |
| `openai` | `@ai-sdk/openai` | `gpt-4o` |
| `google` | `@ai-sdk/google` | `gemini-2.0-flash` |

## Built-in Components

### Inbound Adapters

| Type | Description | Options |
|------|-------------|---------|
| `resend` | Email via Resend webhooks, with signature verification | `webhookSecret`, `apiKey` |
| `webhook` | Generic JSON webhook, no auth | — |

### Sources

| Type | Description | Options |
|------|-------------|---------|
| `google-sheets` | Read/write Google Sheets | `sheetId`, `credentials: { clientEmail, privateKey }`, `tabs` |

Sources become LLM tools: `query_<name>` and `write_<name>`.

### Actions

| Type | Description | Options |
|------|-------------|---------|
| `reply` | Send email reply via Resend | `apiKey`, `fromAddress` |
| `triage` | Escalate to a human via email | `apiKey`, `fromAddress`, `triageRecipient` |
| `log` | Structured JSON log to console | — |

Actions become LLM tools: `action_<name>`.

### Triage Config

Controls when the agent escalates to a human instead of auto-responding.

```json
{
  "triage": {
    "confidenceThreshold": 0.7,
    "alwaysTriage": ["refund", "dispute", "fraud"],
    "maxAutoReplies": 3,
    "triageChannel": "email",
    "includeRecommendation": true
  }
}
```

## Example: Expense Tracker

A working example that receives forwarded receipt emails, extracts expense data, logs to Google Sheets, and replies with a budget summary.

```
examples/expense-tracker/
├── relay-agent.config.json
└── .env.example
```

```bash
cd examples/expense-tracker
cp .env.example .env
# Fill in your API keys
npx relay-agent start --config relay-agent.config.json
```

Forward a receipt to your Resend inbound address and the agent will:

1. Extract vendor, amount, date, category
2. Check Google Sheets for duplicates
3. Log the expense
4. Reply with what was logged and current budget status

## Programmatic API

The config-driven CLI is built on top of the library API, which is still fully available for advanced use cases.

```typescript
import {
  createRelayAgent,
  createResendAdapter,
  createGoogleSheetsSource,
  createReplyAction,
  createTriageAction,
  createLogAction,
} from "relay-agent";
import { anthropic } from "@ai-sdk/anthropic";

const agent = createRelayAgent({
  name: "My Agent",
  description: "...",
  instructions: "...",
  model: anthropic("claude-sonnet-4-20250514"),
  sources: [createGoogleSheetsSource({ ... })],
  actions: [createReplyAction({ ... }), createLogAction()],
});

const result = await agent.process(message);
```

## CLI Reference

```
relay-agent — Config-driven AI agent service

Usage:
  relay-agent start --config <path>   Start the agent server
  relay-agent --help                  Show this help message
```

The server exposes:

- `GET /health` — Returns `{ status: "ok", agent: "<name>" }`
- `POST /webhook/<adapter>` — Receives inbound messages (e.g. `/webhook/resend`)

## Development

```bash
pnpm install
pnpm run build    # Compile library + CLI
pnpm test         # Run all tests
pnpm run dev      # Watch mode
```

## License

MIT
