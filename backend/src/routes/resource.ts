import { FastifyInstance } from "fastify";
import { z, ZodObject, ZodTypeAny } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { TableConfig } from "drizzle-orm";
import { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

export interface ResourceConfig {
  tag: string;
  table: PgTable<TableConfig>;
  // column key on the table that holds user_id
  ownerColumn: string;
  // zod schema for the insert payload (server-validated)
  createSchema: ZodObject<any>;
  // optional partial update schema
  updateSchema?: ZodObject<any>;
}

// Registers REST CRUD for a resource backed by Drizzle + Supabase ownership.
// GET /:userId  (own rows) · POST /  · PATCH /:id  · DELETE /:id
export function registerResource(app: FastifyInstance, cfg: ResourceConfig) {
  const { table, ownerColumn, createSchema, updateSchema } = cfg;

  app.get(`/${cfg.tag}`, { preHandler: requireAuth }, async (req, reply) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(table)
      .where(eq((table as any)[ownerColumn] as AnyPgColumn, req.userId!))
      .orderBy(desc((table as any).createdAt ?? (table as any)[ownerColumn]));
    return rows;
  });

  app.post(`/${cfg.tag}`, { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(table)
      .values({ ...parsed, [ownerColumn]: req.userId })
      .returning();
    return reply.code(201).send(row);
  });

  app.patch(`/${cfg.tag}/:id`, { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id;
    const parsed = (updateSchema ?? createSchema.partial()).parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(table)
      .set(parsed)
      .where(eq((table as any).id as AnyPgColumn, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "Not found" });
    return row;
  });

  app.delete(`/${cfg.tag}/:id`, { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id;
    const db = getDb();
    const [row] = await db
      .delete(table)
      .where(eq((table as any).id as AnyPgColumn, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "Not found" });
    return reply.code(204).send();
  });
}
