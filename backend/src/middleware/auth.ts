import { FastifyRequest, FastifyReply } from "fastify";
import { verifyUser } from "../lib/supabase.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

// Populates request.userId from the Supabase JWT. Does NOT reject anonymous
// requests — routes decide whether auth is required.
export async function authPreHandler(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const uid = await verifyUser(token);
  if (uid) req.userId = uid;
}

// Rejects requests without a valid user.
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  await authPreHandler(req, reply);
  if (!req.userId) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}
