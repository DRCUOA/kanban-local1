import { logger } from '@shared/logger';

type TracePrimitive = string | number | boolean | null | undefined;
type TraceValue = TracePrimitive | TracePrimitive[];

export type GmailInboundTraceFields = Record<string, TraceValue>;

function isTraceEnabled(): boolean {
  const value = process.env.GMAIL_INBOUND_TRACE;
  return value === 'true' || value === '1';
}

export function logGmailInboundTrace(stage: string, fields: GmailInboundTraceFields = {}): void {
  if (!isTraceEnabled()) return;
  logger.info('gmail inbound trace', {
    pipeline: 'gmail_inbound',
    stage,
    ...fields,
  });
}

export function getErrorTraceFields(error: unknown): GmailInboundTraceFields {
  if (error instanceof Error) {
    const detail = error as Error & {
      code?: number | string;
      response?: { status?: number };
    };

    return {
      error_name: detail.name,
      error_message: detail.message,
      error_code:
        typeof detail.code === 'number' || typeof detail.code === 'string'
          ? detail.code
          : undefined,
      error_status: detail.response?.status,
    };
  }

  return {
    error_message: String(error),
  };
}
