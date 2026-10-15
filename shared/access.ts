/** Shared between the access gate (server/access) and the client's welcome and console screens. */

export const ACCESS_TRUST_DAYS = 90;
/** Answer of a gated request without an admitted device; the client shows the access-code screen on it. */
export const ACCESS_REQUIRED = 'access-required';
export const DEVELOPER_SECRET_HEADER = 'x-developer-secret';

export interface AccessStatus {
  /** False when the deployment runs without access control (local development). */
  enabled: boolean;
  admitted: boolean;
}

export interface ConsoleDevice {
  id: number;
  kind: 'device' | 'export-token';
  label: string;
  status: 'live' | 'revoked' | 'not-used';
  issuedAt: string;
  admittedAt: string | null;
  lastSeenAt: string | null;
  /** When a device's 90 days run out; null for tokens and unused codes. */
  trustedUntil: string | null;
}
