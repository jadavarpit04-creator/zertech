import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/automation/triggers
 *
 * Returns available triggers for external automation integration.
 * External automation platforms poll this to discover available triggers.
 */
export async function GET() {
  return NextResponse.json({
    triggers: [
      {
        name: "New Draft Created",
        key: "draft.created",
        description: "Triggered when a new follow-up draft is created",
        samplePayload: {
          trigger: "draft.created",
          payload: {
            id: "uuid",
            kind: "invoice",
            recipient_name: "Client Name",
            recipient_email: "client@example.com",
            subject: "Reminder: Invoice",
            status: "pending",
          },
        },
      },
      {
        name: "Invoice Becomes Overdue",
        key: "invoice.overdue",
        description: "Triggered when an invoice becomes overdue",
        samplePayload: {
          trigger: "invoice.overdue",
          payload: {
            id: "uuid",
            client_name: "Client Name",
            amount: 2500,
            due_date: "2026-06-01",
            days_overdue: 10,
          },
        },
      },
      {
        name: "Draft Sent",
        key: "draft.sent",
        description: "Triggered when a draft is approved and sent",
        samplePayload: {
          trigger: "draft.sent",
          payload: {
            id: "uuid",
            kind: "invoice",
            recipient_email: "client@example.com",
            subject: "Reminder: Invoice",
            sent_at: "2026-07-20T10:00:00Z",
          },
        },
      },
      {
        name: "New Lead Detected",
        key: "lead.new",
        description: "Triggered when a new lead is detected and scored",
        samplePayload: {
          trigger: "lead.new",
          payload: {
            id: "uuid",
            name: "Lead Name",
            email: "lead@example.com",
            score: 4,
            source: "Website",
          },
        },
      },
      {
        name: "Draft Approved",
        key: "draft.approved",
        description: "Triggered when a user approves a draft for sending",
        samplePayload: {
          trigger: "draft.approved",
          payload: {
            id: "uuid",
            kind: "invoice",
            recipient_name: "Client Name",
            recipient_email: "client@example.com",
            subject: "Reminder: Invoice",
            body: "Hi Client, ...",
            approved_at: "2026-07-20T10:00:00Z",
          },
        },
      },
      {
        name: "Email Parsed",
        key: "email.parsed",
        description: "Triggered when an incoming email is parsed and stored via intake",
        samplePayload: {
          trigger: "email.parsed",
          payload: {
            type: "invoice",
            invoice_id: "uuid",
            draft_id: "uuid",
            client_name: "Client Name",
            amount: 2500,
          },
        },
      },
    ],
  });
}
