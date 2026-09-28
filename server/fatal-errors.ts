import { logger } from '@shared/logger';

/**
 * Make a fatal error readable in hosted logs.
 *
 * Node's default crash output opens with the entire source line of the throw
 * site. In the minified bundle a line runs to ~100 KB, and Railway cuts each
 * log entry at 64 KB, so the message itself never reaches the log — a missing
 * DATABASE_URL showed up as twenty copies of the same slab of minified code.
 * These handlers log the message and stack first, then exit as the default
 * would have.
 */

/** One log line: `<kind>: <stack, or message when there is none>`. */
export function describeFatal(kind: string, error: unknown): string {
  if (error instanceof Error) return `${kind}: ${error.stack ?? error.message}`;
  return `${kind}: ${String(error)}`;
}

/**
 * Registers the handlers. Import `./fatal-errors.install` before any module
 * that can throw while loading (the database client checks its env there).
 */
export function installFatalErrorLogging(): void {
  const exitWith = (kind: string) => (error: unknown) => {
    logger.error(describeFatal(kind, error));
    process.exit(1);
  };
  process.on('uncaughtException', exitWith('Uncaught exception'));
  process.on('unhandledRejection', exitWith('Unhandled rejection'));
}
