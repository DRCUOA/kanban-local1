import type { Response } from 'express';

/**
 * Parse a numeric ID from an Express route param string.
 * Returns the parsed number on success, or sends a 400 JSON error and returns null.
 */
export function parseIdParam(raw: string | undefined, res: Response, label = 'ID'): number | null {
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  if (isNaN(parsed)) {
    res.status(400).json({ error: `Invalid ${label}`, status: 400 });
    return null;
  }
  return parsed;
}
