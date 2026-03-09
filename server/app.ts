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
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  app.use(errorHandler);

  return { app, httpServer };
}
