import "dotenv/config";
import Fastify, { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { logger } from "./lib/logger.js";
import { registerRoutes } from "./routes/index.js";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true, credentials: true });

  await app.register(swagger, {
    openapi: {
      info: { title: "Zertech API", version: "0.1.0" },
      components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

  app.setErrorHandler((err, _req, reply) => {
    logger.error({ err: err.message, stack: err.stack });
    if (err.validation) {
      return reply.code(400).send({ error: "Validation failed", details: err.validation });
    }
    return reply.code(err.statusCode ?? 500).send({ error: err.message });
  });

  await registerRoutes(app);

  return app;
}

// Boot unconditionally when this module is the entry point.
// (import.meta comparison is unreliable under detatched spawn / Windows paths.)
const app = await buildServer();
const port = Number(process.env.PORT ?? 4000);
try {
  await app.listen({ port, host: "0.0.0.0" });
  logger.info(`Zertech backend listening on :${port}`);
} catch (e) {
  logger.error({ msg: "boot failed", err: (e as Error).message });
  process.exit(1);
}
