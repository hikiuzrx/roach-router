import { buildServer } from "./src/server.ts";
import { config } from "./src/config.ts";

const app = await buildServer();

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ component: "lifecycle", signal }, "shutting down");
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    app.log.error({ component: "lifecycle", err: message }, "shutdown failed");
    process.exit(1);
  }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.server.host, port: config.server.port });
} catch (err) {
  app.log.error(err, "listen failed");
  process.exit(1);
}
