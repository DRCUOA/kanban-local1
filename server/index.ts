/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import 'dotenv/config';
import express, { type Request, Response, NextFunction } from 'express';
import { registerRoutes } from './routes';
import { seedDatabase } from './seed';
import { storage } from './storage';
import { serveStatic } from './static';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = 'express') {
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await seedDatabase(storage);
  await registerRoutes(httpServer, app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const errObj = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
    const rawStatus = errObj.status || errObj.statusCode || 500;
    const status = typeof rawStatus === 'number' ? rawStatus : 500;
    const message = err instanceof Error ? err.message : 'Internal Server Error';

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  } else {
    const { setupVite } = await import('./vite');
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  httpServer.listen(port, '0.0.0.0', () => {
    log(`serving on port ${port}`);
  });
})();
