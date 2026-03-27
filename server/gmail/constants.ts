/** v1 operational constants (see development/email-trigger plan). */
export const PROVIDER_GMAIL = 'gmail' as const;
export const RECOVERY_NEWER_THAN_QUERY = 'newer_than:3d'; // 72 hours
export const LEASE_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_ATTEMPTS = 5;
export const POLL_INTERVAL_MS = 15_000; // 15 seconds
