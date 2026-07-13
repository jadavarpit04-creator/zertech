
# Agency Follow-up Agent — MVP Build Plan

Black & white "sleek modern mono" aesthetic (dark bg, mono accents, smooth motion). Supabase for auth + database. Approval-before-send is on by default per workflow, with a per-workflow toggle to allow auto-send later.

## Design system

- Palette: near-black `#0a0a0a` bg, off-white `#f5f5f5` fg, mid-grey borders, single accent = pure white.
- Type: mono display (JetBrains Mono / Geist Mono) for headings + numerals, clean sans (Geist / Inter) for body.
- Motion: framer-motion — subtle fade/slide on section enter, smooth scroll on landing, animated status pills, typewriter effect on hero tagline.
- All tokens defined in `src/styles.css` under `@theme`. No hardcoded colors in components.

## Routes

Public:
- `/` — landing (hero, problem, workflows, pricing, CTA)
- `/auth` — email/password + Google sign-in
- `/api/public/webhooks/inbox` — placeholder webhook endpoint (stub)

Protected (`_authenticated/`):
- `/dashboard` — pending tasks, sent count, recent activity, empty state
- `/invoices` — list + import + status
- `/leads` — list + import + status
- `/approvals` — queue of drafted messages awaiting approval (edit / approve / send / discard)
- `/history` — full log of actions
- `/settings` — inbox connection (Gmail stub), Sheets sync toggle, workflow auto-send toggles

## Data model (Supabase)

Tables (all with grants + RLS scoped to `auth.uid()`):
- `profiles` — id, full_name, company, created_at
- `workflow_settings` — user_id, workflow ('invoice'|'lead'), auto_send bool default false, approval_required bool default true
- `invoices` — id, user_id, client_name, client_email, amount, due_date, status ('pending'|'overdue'|'paid'), created_at
- `leads` — id, user_id, name, email, source, status ('new'|'contacted'|'qualified'|'lost'), created_at
- `drafts` — id, user_id, kind ('invoice'|'lead'), source_id, subject, body, status ('pending'|'approved'|'sent'|'discarded'), created_at, sent_at
- `activity_log` — id, user_id, action, entity_type, entity_id, meta jsonb, created_at
- `integrations` — id, user_id, provider ('gmail'|'sheets'), connected bool, meta jsonb

`has_role` pattern not needed for MVP (single-role users).

## Server functions (`createServerFn` + `requireSupabaseAuth`)

- `importInvoices` / `importLeads` — accept CSV-parsed rows
- `detectOverdue` — mark invoices past due_date as overdue, create draft rows
- `generateLeadDraft` — create draft for new lead (AI stub: template-filled text via Lovable AI Gateway later; MVP uses templated strings)
- `approveDraft` / `discardDraft` / `editDraft`
- `sendDraft` — marks sent, logs activity (email send itself is stubbed for MVP — writes to activity_log with "would send via Gmail")
- `syncToSheets` — stub logging entry

## Approval flow

Default: `workflow_settings.approval_required = true`. Every draft lands in `/approvals`. Toggle in `/settings` flips per-workflow auto-send; when enabled, `generateLeadDraft` / `detectOverdue` call `sendDraft` immediately.

## Landing page

Sections: hero (animated mono tagline), problem statement, 3 workflow cards (Invoice reminders / Lead follow-up / History log), how-it-works 4-step, pricing (3 tiers from PRD), footer. Distinct `head()` metadata.

## Tech notes

- TanStack Start + TanStack Query (loader `ensureQueryData` + `useSuspenseQuery`).
- Supabase browser client in components; `requireSupabaseAuth` server fns for all data.
- Google OAuth via `lovable.auth.signInWithOAuth("google")` + `supabase--configure_social_auth`.
- Gmail sending, real AI drafting, and Sheets sync are **stubbed** in MVP — UI + activity logging works end-to-end; wire real providers in a follow-up (needs Gmail OAuth + Google Sheets connector + Lovable AI Gateway).

## Build order

1. Enable Lovable Cloud; migration for all tables + RLS + grants.
2. Design tokens in `styles.css`; shared shell (nav, sidebar for auth'd routes).
3. Landing page + `/auth` (email + Google).
4. `_authenticated` layout + dashboard shell with empty states.
5. Invoices + leads pages with CSV import + list.
6. Draft generation + approvals queue + send (stubbed) + activity log.
7. Settings page (auto-send toggles, integration stubs).
8. History page.
9. Polish: animations, empty states, meta.

## Out of scope for this build

Real Gmail send, real AI draft generation, real Sheets sync, Outlook, Slack/Telegram notifications, analytics, custom workflow builder, payments.
