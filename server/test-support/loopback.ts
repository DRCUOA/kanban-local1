import { createServer, type RequestListener, type Server } from 'node:http';

/**
 * Serve an app on 127.0.0.1 for supertest, which then reuses this listener
 * instead of starting its own.
 *
 * `request(app)` given a bare app starts a server per request with
 * `listen(0)`, which binds `::`, then dials `127.0.0.1`. On macOS, with
 * several test processes running at once (vitest's workers, or two suites),
 * that pairing let a request reach another process's server (a 404 for a
 * route this app has), be reset ("socket hang up"), or hang until the test
 * timed out. Measured with 12 processes: 7 such requests in 26,400 with the
 * `::` bind, none in 22,800 with the listener bound to the address supertest
 * dials. Close the server in `afterEach`.
 */
export async function serveOnLoopback(app: RequestListener): Promise<Server> {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
