# Make.com + Zertech Integration Guide

A complete end-to-end guide to connecting Make.com with Zertech.

---

## Prerequisites

- A Zertech account (running at http://localhost:8080)
- A [Make.com](https://www.make.com) account (free tier - 1,000 ops/month)

---

## How It Works

Zertech and Make.com talk to each other in two directions:

`
  Zertech --POST event--> Make.com  (webhook trigger)
  Make.com --POST action--> Zertech (HTTP module)
`

**Zertech sends events** to Make.com when things happen (draft created, invoice overdue, etc.)
**Make.com sends actions** to Zertech to perform tasks (send a draft, run a scan, etc.)

---

## Step 1: Get Your Make.com Webhook URL

The webhook URL is how Zertech sends events to Make.com.

1. Log in to [make.com](https://www.make.com)
2. Click **Create a new scenario**
3. Click the **+** button to add the first module
4. Search for and select **Webhook > Custom webhook**
5. Click **Create a webhook**, then **Save**
6. Make.com generates a URL like https://hook.eu1.make.com/xxxxx... - **copy this URL**
7. Keep this tab open - you'll come back to build the scenario

Now paste that URL in Zertech's .env file:

`env
MAKE_WEBHOOK_URL=https://hook.eu1.make.com/your-copied-url-here
`

Once added, restart Zertech so it picks up the new URL.

---

## Step 2: Confirm Zertech Is Sending Events

Zertech will now automatically POST events to Make.com when:

| Event | When it happens |
|-------|----------------|
| draft.created | A new follow-up draft is created from an overdue invoice or lead |
| invoice.overdue | An invoice is detected as overdue during a scan |
| draft.sent | A draft is approved and sent via Gmail |

To test:
1. In Make.com, click **Run once** on your scenario - this puts the webhook in listening mode
2. Go to Zertech and trigger an action (e.g., run an invoice scan)
3. Make.com will capture the incoming event - you will see the JSON payload

The payload looks like this:

`json
{
  "trigger": "invoice.overdue",
  "payload": {
    "id": "abc-123",
    "client_name": "Acme Corp",
    "amount": 2500,
    "due_date": "2026-07-01",
    "days_overdue": 19
  }
}
`

Make.com maps these fields as {{1.trigger}}, {{1.payload.id}}, etc.

---

## Step 3: Auto-Send Draft When Invoice Is Overdue

When Zertech detects an overdue invoice, Make.com automatically sends the follow-up draft.

### 3.1 Webhook Trigger
Your first module should already be a **Webhook > Custom webhook** from Step 1.

### 3.2 Add HTTP Action
1. Click the **+** after the webhook module
2. Search and select **HTTP > Make a request**
3. Configure:

| Field | Value |
|-------|-------|
| **URL** | http://localhost:8080/api/automation/actions |
| **Method** | POST |
| **Headers** | Content-Type: application/json |
| **Body** | {"action": "send_draft", "params": {"id": "{{1.payload.id}}"}} |

### 3.3 Test
1. Click **Run once** - Make waits for an event
2. In Zertech, run an invoice scan
3. Make receives invoice.overdue, then calls Zertech to send the draft

### 3.4 Turn It On
Click the toggle to enable the scenario. It runs automatically whenever Zertech sends an event.

---

## Step 4: Create Draft from New Lead

Create a **new scenario**:

1. **Trigger:** Webhook > Custom webhook (create a new webhook URL)
2. **Action:** HTTP > Make a request with:

`json
{
  "action": "create_draft",
  "params": {
    "kind": "lead",
    "recipient_name": "{{1.payload.recipient_name}}",
    "recipient_email": "{{1.payload.recipient_email}}",
    "subject": "{{1.payload.subject}}"
  }
}
`

3. Test and enable

---

## Actions Reference

### send_draft
Sends a follow-up email for a draft.
`json
{"action": "send_draft", "params": {"id": "draft-uuid-here"}}
`

### create_draft
Creates a new follow-up draft.
`json
{"action": "create_draft", "params": {"kind": "invoice", "recipient_name": "Client", "recipient_email": "c@x.com", "subject": "Reminder"}}
`

### run_scan
Scans for overdue invoices and creates drafts.
`json
{"action": "run_scan", "params": {}}
`

### list_pending
Returns all pending drafts.
`json
{"action": "list_pending", "params": {}}
`

---

## Troubleshooting

**Webhook says "no data received"**
- Make sure Zertech is running and MAKE_WEBHOOK_URL is set correctly in .env
- Click **Run once** to put the webhook in listening mode before triggering the event

**HTTP action returns 401**
- You need to be logged into Zertech (actions require a session)

**Check execution logs**
- In Make.com, open your scenario and click the **History** tab
- Each execution shows input/output of every module

**Need a new webhook URL?**
- Just paste it in .env as MAKE_WEBHOOK_URL and restart Zertech
