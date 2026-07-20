# ActivePieces + Zertech Integration Guide

## Quick Start

### 1. No API Key Needed
✅ ActivePieces free tier works with Zertech out of the box.
No API keys required — just use HTTP webhook actions.

### 2. Configure ActivePieces to connect to Zertech

#### As a Trigger (Zertech → ActivePieces):
Zertech can send webhooks to ActivePieces when events happen:

1. In ActivePieces, create a new flow
2. Add a **Webhook** trigger
3. Set the webhook URL to your ActivePieces webhook endpoint
4. In Zertech, events will POST to ActivePieces when:
   - `draft.created` - A new follow-up draft is created
   - `invoice.overdue` - An invoice becomes overdue
   - `draft.sent` - A draft is approved and sent
   - `lead.new` - A new lead is detected

#### As an Action (ActivePieces → Zertech):
ActivePieces can call Zertech's API to perform actions:

1. In ActivePieces, add an **HTTP** action
2. Set method to `POST`
3. Set URL to `https://your-zertech-domain.com/api/automation/actions`
4. Set headers: `Content-Type: application/json`
5. Set body to:
   ```json
   {
     "action": "send_draft",
     "params": { "id": "draft-uuid-here" }
   }
   ```

### 3. Available Actions

| Action | Method | Description |
|--------|--------|-------------|
| `create_draft` | POST | Create a new follow-up draft |
| `send_draft` | POST | Approve and send a draft |
| `run_scan` | POST | Trigger invoice overdue scan |
| `list_pending` | POST | List pending drafts |

### 4. Available Triggers

| Trigger | Description | Sample Webhook Payload |
|---------|-------------|----------------------|
| `draft.created` | New draft created | `{ "trigger": "draft.created", "payload": { "id": "uuid", "kind": "invoice", ... } }` |
| `invoice.overdue` | Invoice becomes overdue | `{ "trigger": "invoice.overdue", "payload": { "id": "uuid", "client_name": "...", ... } }` |
| `draft.sent` | Draft approved and sent | `{ "trigger": "draft.sent", "payload": { "id": "uuid", "kind": "invoice", ... } }` |
| `lead.new` | New lead detected | `{ "trigger": "lead.new", "payload": { "id": "uuid", "name": "...", ... } }` |

### 5. Verify Connectivity

Test the connection:
```bash
# Check API health
curl https://your-zertech-domain.com/api/automation/webhook

# List available triggers
curl https://your-zertech-domain.com/api/automation/triggers

# Send a test webhook
curl -X POST https://your-zertech-domain.com/api/automation/webhook \
  -H "Content-Type: application/json" \
  -d '{"trigger": "custom", "payload": {"test": true}}'
```

### 6. Example: Send Slack Notification When Invoice Goes Overdue

1. In ActivePieces, create a new flow
2. Add **Webhook** trigger → point to `https://your-zertech-domain.com/api/automation/webhook`
3. Add a filter: `trigger == "invoice.overdue"`
4. Add **Slack** action → Send message with invoice details
5. Enable the flow

### 7. MCP Configuration

If using AI tools (Cursor, Claude, etc.) with MCP:

1. Copy `activepieces.mcp.json` to your project root
2. Set `ACTIVE_PIECES_API_KEY` environment variable
3. The MCP server will allow AI agents to manage ActivePieces flows
