/* eslint-disable @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matchers are intentionally loose in these assertions */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStorage = vi.hoisted(() => ({
  getStages: vi.fn(),
}));

const mockCreateEmailTasks = vi.hoisted(() => vi.fn());
const mockGetGmailApi = vi.hoisted(() => vi.fn());
const mockNormalizeGmailMessageParts = vi.hoisted(() => vi.fn());
const mockHashBody = vi.hoisted(() => vi.fn());
const mockClaimNextPendingRow = vi.hoisted(() => vi.fn());
const mockGetInboundById = vi.hoisted(() => vi.fn());
const mockMarkInboundCompleted = vi.hoisted(() => vi.fn());
const mockMarkInboundFailed = vi.hoisted(() => vi.fn());
const mockMarkInboundPendingRetry = vi.hoisted(() => vi.fn());
const mockReconcileExpiredLeases = vi.hoisted(() => vi.fn());
const mockInvokeEmailTaskGraph = vi.hoisted(() => vi.fn());

vi.mock('../storage', () => ({
  storage: mockStorage,
  createEmailTasks: mockCreateEmailTasks,
}));

vi.mock('../gmail/gmail-client', () => ({
  getGmailApi: mockGetGmailApi,
}));

vi.mock('../gmail/normalize-email', () => ({
  normalizeGmailMessageParts: mockNormalizeGmailMessageParts,
  hashBody: mockHashBody,
}));

vi.mock('../inbound-email/repository', () => ({
  claimNextPendingRow: mockClaimNextPendingRow,
  getInboundById: mockGetInboundById,
  markInboundCompleted: mockMarkInboundCompleted,
  markInboundFailed: mockMarkInboundFailed,
  markInboundPendingRetry: mockMarkInboundPendingRetry,
  reconcileExpiredLeases: mockReconcileExpiredLeases,
}));

vi.mock('../langgraph/email-task-graph', () => ({
  invokeEmailTaskGraph: mockInvokeEmailTaskGraph,
}));

import { processOneInboundRow } from './inbound-email-worker';

function makeInboundRow() {
  return {
    id: 9,
    provider: 'gmail',
    gmailMessageId: 'gmail-123',
    rfcMessageId: null,
    historyIdSeen: 'history-1',
    recipient: null,
    normalizedSubject: null,
    normalizedBodyHash: null,
    processingStatus: 'processing',
    createdTaskId: null,
    createdTaskIds: null,
    errorReason: null,
    processedAt: null,
    attemptCount: 1,
    lastAttemptAt: null,
    leaseExpiresAt: null,
    createdAt: new Date('2026-03-28T12:00:00Z'),
    updatedAt: new Date('2026-03-28T12:00:00Z'),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.GMAIL_TRIGGER_RECIPIENT;

  const row = makeInboundRow();
  mockClaimNextPendingRow.mockResolvedValue(row);
  mockGetInboundById.mockResolvedValue(row);
  mockHashBody.mockReturnValue('hash-1');
  mockNormalizeGmailMessageParts.mockReturnValue({
    plainBody: 'Body text',
    snippetFallback: 'Body text',
  });
  mockGetGmailApi.mockReturnValue({
    users: {
      messages: {
        get: vi.fn().mockResolvedValue({
          data: {
            snippet: 'Body text',
            payload: {
              headers: [
                { name: 'Subject', value: 'This is an EPIC: rollout SSO' },
                { name: 'To', value: 'board@example.com' },
                { name: 'Message-ID', value: '<message-id>' },
              ],
            },
          },
        }),
      },
    },
  });
});

describe('processOneInboundRow', () => {
  it('starts stage loading in parallel with graph execution and persists parent plus children', async () => {
    let stagesStarted = false;
    let graphStarted = false;
    let resolveStages: ((value: unknown) => void) | undefined;
    let resolveGraph: ((value: unknown) => void) | undefined;

    const stagesPromise = new Promise((resolve) => {
      resolveStages = resolve;
    });
    const graphPromise = new Promise((resolve) => {
      resolveGraph = resolve;
    });

    mockStorage.getStages.mockImplementation(() => {
      stagesStarted = true;
      return stagesPromise;
    });
    mockInvokeEmailTaskGraph.mockImplementation(() => {
      graphStarted = true;
      return graphPromise;
    });
    mockCreateEmailTasks.mockResolvedValue({
      parent: { id: 101 },
      children: [{ id: 102 }, { id: 103 }],
    });

    const work = processOneInboundRow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stagesStarted).toBe(true);
    expect(graphStarted).toBe(true);

    resolveStages?.([
      { id: 1, name: 'Backlog', order: 0, color: null, createdAt: new Date() },
      { id: 2, name: 'In Progress', order: 1, color: null, createdAt: new Date() },
    ]);
    resolveGraph?.({
      parentTask: {
        title: 'EPIC: Roll out SSO',
        description: 'Ship SSO for enterprise customers.',
        priority: 'critical',
        targetStageName: 'In Progress',
      },
      childTasks: [
        {
          title: 'Audit SSO requirements',
          description: 'Review provider docs.',
          priority: 'high',
          targetStageName: null,
        },
        {
          title: 'Implement callback flow',
          description: 'Wire callback and account linking.',
          priority: 'high',
          targetStageName: 'Backlog',
        },
      ],
      flags: {
        isEpic: true,
        usedWebSearch: true,
      },
      searchContext: {
        query: 'how to roll out sso',
        summary: 'Set up the provider, wire callbacks, then test and migrate users.',
        sources: [],
      },
    });

    await work;

    expect(mockCreateEmailTasks).toHaveBeenCalledOnce();
    expect(mockCreateEmailTasks).toHaveBeenCalledWith({
      parent: expect.objectContaining({
        title: 'EPIC: Roll out SSO',
        stageId: 2,
        priority: 'critical',
      }),
      children: [
        expect.objectContaining({
          title: 'Audit SSO requirements',
          stageId: 2,
          priority: 'high',
        }),
        expect.objectContaining({
          title: 'Implement callback flow',
          stageId: 1,
          priority: 'high',
        }),
      ],
    });
    expect(mockMarkInboundCompleted).toHaveBeenCalledWith(9, 101, [101, 102, 103]);
  });

  it('marks skipped recipients as completed without created tasks', async () => {
    process.env.GMAIL_TRIGGER_RECIPIENT = 'expected@example.com';

    await processOneInboundRow();

    expect(mockInvokeEmailTaskGraph).not.toHaveBeenCalled();
    expect(mockCreateEmailTasks).not.toHaveBeenCalled();
    expect(mockMarkInboundCompleted).toHaveBeenCalledWith(9, null, []);
  });
});
