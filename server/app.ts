import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import { registerRoutes } from './routes';
import { errorHandler } from './errors';

/**
 * Build a fully-wired Express app (with routes + error handler) without
 * calling listen(). Allows tests to import the app via supertest and
 * keeps the server startup concern in index.ts.
 */
export async function createApp(): Promise<{ app: express.Express; httpServer: Server }> {
  const app = express();
  // 10mb: task descriptions can embed image attachments as data URLs.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  app.use(errorHandler);

  return { app, httpServer };
}
