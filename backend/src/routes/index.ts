import { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerResource } from "./resource.js";
import { invoices, leads, drafts, emailTemplates, activityLog, integrations } from "../db/schema.js";

export function registerRoutes(app: FastifyInstance) {
  // ---- invoices ----
  registerResource(app, {
    tag: "invoices",
    table: invoices,
    ownerColumn: "userId",
    createSchema: z.object({
      clientName: z.string().min(1),
      clientEmail: z.string().email(),
      amount: z.number().nonnegative().optional(),
      dueDate: z.string().min(1),
      status: z.enum(["pending", "overdue", "paid"]).optional(),
    }),
    updateSchema: z.object({
      clientName: z.string().min(1).optional(),
      clientEmail: z.string().email().optional(),
      amount: z.number().nonnegative().optional(),
      dueDate: z.string().min(1).optional(),
      status: z.enum(["pending", "overdue", "paid"]).optional(),
    }),
  });

  // ---- leads ----
  registerResource(app, {
    tag: "leads",
    table: leads,
    ownerColumn: "userId",
    createSchema: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      source: z.string().optional(),
      status: z.enum(["new", "contacted", "qualified", "lost"]).optional(),
    }),
    updateSchema: z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      source: z.string().optional(),
      status: z.enum(["new", "contacted", "qualified", "lost"]).optional(),
    }),
  });

  // ---- drafts ----
  registerResource(app, {
    tag: "drafts",
    table: drafts,
    ownerColumn: "userId",
    createSchema: z.object({
      kind: z.enum(["invoice", "lead"]),
      sourceId: z.string().uuid().optional(),
      recipientName: z.string().min(1),
      recipientEmail: z.string().email(),
      subject: z.string().min(1),
      body: z.string().min(1),
      status: z.enum(["pending", "approved", "sent", "discarded", "scheduled"]).optional(),
      scheduledAt: z.string().datetime().optional(),
    }),
    updateSchema: z.object({
      recipientName: z.string().min(1).optional(),
      recipientEmail: z.string().email().optional(),
      subject: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
      status: z.enum(["pending", "approved", "sent", "discarded", "scheduled"]).optional(),
      scheduledAt: z.string().datetime().optional(),
    }),
  });

  // ---- email_templates ----
  registerResource(app, {
    tag: "email-templates",
    table: emailTemplates,
    ownerColumn: "userId",
    createSchema: z.object({
      kind: z.enum(["invoice", "lead"]),
      name: z.string().min(1),
      subject: z.string().min(1),
      body: z.string().min(1),
      isDefault: z.boolean().optional(),
    }),
    updateSchema: z.object({
      kind: z.enum(["invoice", "lead"]).optional(),
      name: z.string().min(1).optional(),
      subject: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
      isDefault: z.boolean().optional(),
    }),
  });

  // ---- activity_log (read + create only) ----
  registerResource(app, {
    tag: "activity",
    table: activityLog,
    ownerColumn: "userId",
    createSchema: z.object({
      action: z.string().min(1),
      entityType: z.string().optional(),
      entityId: z.string().uuid().optional(),
      meta: z.record(z.any()).optional(),
    }),
  });

  // ---- integrations ----
  registerResource(app, {
    tag: "integrations",
    table: integrations,
    ownerColumn: "userId",
    createSchema: z.object({
      provider: z.enum(["gmail", "sheets", "outlook", "slack"]),
      connected: z.boolean().optional(),
      tokenData: z.any().optional(),
      meta: z.record(z.any()).optional(),
    }),
    updateSchema: z.object({
      connected: z.boolean().optional(),
      tokenData: z.any().optional(),
      meta: z.record(z.any()).optional(),
    }),
  });
}
