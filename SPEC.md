# Relay Agent — Project Spec

> An open-source framework for building AI agents that sit between inbound messages and APIs, acting as intelligent middleware.

## Vision

A lightweight library/framework that lets developers wire up:

**Inbound Channel → AI Agent → Source of Truth → Action**

The agent understands context, cross-references data, and either responds autonomously or triages to a human. The pattern is universal — the framework handles the plumbing, you define the domain.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Inbound    │────▶│  Relay Agent │────▶│ Source of Truth  │
│  (webhook)   │     │   (core)     │     │   (adapters)     │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐
                    │   Actions    │
                    │ Reply/Triage │
                    │ Log/Escalate │
                    └──────────────┘
```

### Core Components

#### 1. Inbound Adapters
Normalise incoming messages into a standard format.

- **Email** (via Resend, SendGrid, Postmark webhooks)
- **WhatsApp** (via Twilio, Meta API)
- **Slack** (Events API)
- **Generic webhook** (raw JSON)

Standard message format:
```typescript
interface InboundMessage {
  id: string
  channel: 'email' | 'whatsapp' | 'slack' | 'webhook'
  from: string
  subject?: string
  body: string
  attachments?: Attachment[]
  metadata: Record<string, any>
  receivedAt: Date
}
```

#### 2. Agent Core
The brain. Receives normalised messages, decides what to do.

- **Context loading** — pulls relevant data from source of truth
- **Intent classification** — what does this message want?
- **Action selection** — respond, triage, log, escalate?
- **Response generation** — drafts reply with real data

```typescript
interface AgentConfig {
  name: string
  description: string                    // used as system prompt context
  instructions: string                   // domain-specific behaviour rules
  sources: SourceAdapter[]               // connected data sources
  actions: Action[]                      // available actions
  triage: TriageConfig                   // when to escalate to human
  model?: string                         // LLM to use (default: configurable)
}
```

#### 3. Source of Truth Adapters
Read (and optionally write) from external systems.

- **Google Sheets** — simple, great for prototyping
- **SQLite/Postgres** — structured data
- **REST API** — generic adapter for any API
- **Sage 200** — accounting/ERP (future)
- **Xero, QuickBooks** — accounting (future)

```typescript
interface SourceAdapter {
  name: string
  description: string                    // helps agent understand what data is available
  query(params: Record<string, any>): Promise<any>
  write?(params: Record<string, any>): Promise<any>
}
```

#### 4. Actions
What the agent can do after processing.

- **Reply** — send response back via the inbound channel
- **Triage** — forward to a human with summary + recommendation
- **Log** — record the interaction
- **Escalate** — flag as urgent
- **Update source** — write back to the source of truth
- **Custom** — developer-defined actions

```typescript
interface Action {
  name: string
  description: string
  execute(context: ActionContext): Promise<ActionResult>
}
```

#### 5. Triage Rules
When the agent should NOT auto-respond.

```typescript
interface TriageConfig {
  confidence_threshold: number           // below this → triage to human
  always_triage: string[]                // keywords/intents that always escalate
  max_auto_replies: number               // per conversation, before forcing human review
  triage_channel: 'email' | 'slack' | 'webhook'  // where to send triaged items
  include_recommendation: boolean        // agent suggests a response for human to approve
}
```

---

## Test Use Case: Expense Receipt Agent

### Overview
An agent that receives forwarded receipt emails, extracts data, logs expenses to a Google Sheet, and replies with summaries.

### Flow
1. User forwards receipt to `expenses@domain.com`
2. Resend receives email → fires webhook to agent
3. Agent extracts: vendor, amount, date, category
4. Agent queries Google Sheet — checks for duplicates, budget status
5. Agent logs the expense to the sheet
6. Agent replies to sender with confirmation + budget summary

### Configuration
```typescript
const expenseAgent = createRelayAgent({
  name: 'Expense Tracker',
  description: 'Processes receipt emails and tracks expenses against budgets',
  instructions: `
    Extract vendor name, amount, date, and category from receipt emails.
    Categories: Office Supplies, Software, Travel, Food, Equipment, Other.
    Flag if amount > £500 or if monthly category budget exceeded.
    Always reply with what was logged and current budget status.
  `,
  sources: [
    googleSheetSource({
      sheetId: 'xxx',
      tabs: {
        expenses: 'Expenses',        // log of all expenses
        budgets: 'Budgets',          // monthly budgets per category
      }
    })
  ],
  actions: [reply(), log(), triage()],
  triage: {
    confidence_threshold: 0.7,
    always_triage: ['refund', 'dispute', 'fraud'],
    max_auto_replies: 3,
    triage_channel: 'email',
    include_recommendation: true,
  }
})
```

### What Success Looks Like
- Forward a Deliveroo receipt → agent replies "Logged £18.50 from Deliveroo under Food. £142/£300 spent this month."
- Forward a duplicate → agent replies "This looks like a duplicate of expense #47 from Feb 12. Not logged. Let me know if it's separate."
- Forward something ambiguous → agent triages to human: "Got an email from 'Smith & Co' — could be Office Supplies or Equipment. Amount: £890 (over £500 threshold). Here's my suggested categorisation..."

---

## Tech Stack (Proposed)

- **Runtime:** Node.js / TypeScript
- **LLM:** Model-agnostic (OpenAI, Anthropic, local via OpenRouter)
- **Inbound email:** Resend (inbound webhooks)
- **Framework:** Hono or Express for webhook server
- **Source adapters:** Google Sheets API, generic REST
- **Package:** Published as npm library + CLI scaffold

---

## Project Structure

```
relay-agent/
├── packages/
│   ├── core/                  # Agent engine, message normalisation, action dispatch
│   ├── adapters-inbound/      # Email, WhatsApp, Slack, webhook adapters
│   ├── adapters-source/       # Google Sheets, SQL, REST, etc.
│   └── actions/               # Reply, triage, log, escalate
├── examples/
│   └── expense-tracker/       # The test use case
├── docs/
└── README.md
```

---

## MVP Scope (v0.1)

Build just enough to prove the pattern with the expense tracker:

1. **Core agent engine** — message in → LLM processing → action out
2. **Email inbound adapter** (Resend webhooks)
3. **Google Sheets source adapter** (read + write)
4. **Reply action** (respond via email)
5. **Triage action** (forward to human)
6. **Expense tracker example** — fully working demo

### Out of Scope for MVP
- WhatsApp/Slack adapters
- Sage 200 / enterprise integrations
- Multi-turn conversations
- Dashboard/UI
- Authentication/multi-tenant

---

## Open Questions

1. **Naming** — "Relay Agent" is a working title. Alternatives?
2. **Conversation state** — MVP is single-turn (one email → one response). When do we add multi-turn?
3. **LLM choice** — default to OpenAI for broad compatibility? Or Anthropic for tool use quality?
4. **Hosting model** — library only? Or also offer a hosted version?
5. **Monorepo vs separate packages** — monorepo (turborepo) for dev convenience?
6. **Attachment handling** — receipts are often PDFs/images. OCR in scope for MVP?

---

## Next Steps

- [ ] Finalise naming
- [ ] Set up repo + monorepo structure
- [ ] Build core agent engine
- [ ] Build Resend inbound adapter
- [ ] Build Google Sheets adapter
- [ ] Wire up expense tracker example
- [ ] Test end-to-end
- [ ] Write docs + README
- [ ] Open source it
