import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeEmailTaskGraph, type EmailTaskExtraction } from './email-task-graph';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeExtraction(overrides: Partial<EmailTaskExtraction> = {}): EmailTaskExtraction {
  return {
    parentTask: {
      title: 'Default task',
      description: 'Default description',
      priority: 'normal',
      targetStageName: 'Backlog',
    },
    childTasks: [],
    flags: {
      isEpic: false,
      usedWebSearch: false,
    },
    searchContext: null,
    ...overrides,
  };
}

describe('invokeEmailTaskGraph', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.OPENAI_EMAIL_GRAPH_MODEL;
  });

  it('returns a single task for a plain email without heavy work', async () => {
    const structuredInvoke = vi
      .fn()
      .mockResolvedValueOnce({
        isHowTo: false,
        isEpic: false,
        searchQuery: null,
      })
      .mockResolvedValueOnce(
        makeExtraction({
          parentTask: {
            title: 'Ship release notes',
            description: 'Draft and publish release notes for Friday.',
            priority: 'high',
            targetStageName: 'Backlog',
          },
        }),
      );
    const searchHowTo = vi.fn();

    const result = await invokeEmailTaskGraph(
      {
        subject: 'Release notes',
        body: 'Please create a task to draft release notes for Friday.',
      },
      {
        structuredInvoke,
        searchHowTo,
      },
    );

    expect(searchHowTo).not.toHaveBeenCalled();
    expect(result.parentTask.title).toBe('Ship release notes');
    expect(result.childTasks).toEqual([]);
    expect(result.flags.isEpic).toBe(false);
    expect(result.flags.usedWebSearch).toBe(false);
  });

  it('runs search and epic decomposition in parallel', async () => {
    // Parallel means both slow steps are in flight at once. Count that rather
    // than timing the run, which a loaded machine stretches past any bound.
    let inFlight = 0;
    let peakInFlight = 0;
    async function slowStep<T>(value: T): Promise<T> {
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await delay(90);
      inFlight--;
      return value;
    }
    const structuredInvoke = vi
      .fn()
      .mockResolvedValueOnce({
        isHowTo: true,
        isEpic: true,
        searchQuery: 'how to roll out sso integration',
      })
      .mockImplementationOnce(() =>
        slowStep({
          childTasks: [
            {
              title: 'Audit SSO requirements',
              description: 'Review the provider docs and current auth flow.',
              priority: 'high',
              targetStageName: 'Backlog',
            },
            {
              title: 'Implement SSO callback flow',
              description: 'Add callback handling and session linking.',
              priority: 'high',
              targetStageName: 'In Progress',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        makeExtraction({
          parentTask: {
            title: 'EPIC: SSO rollout',
            description: 'Roll out SSO for enterprise customers.',
            priority: 'critical',
            targetStageName: 'Backlog',
          },
          childTasks: [],
          flags: {
            isEpic: true,
            usedWebSearch: true,
          },
        }),
      );
    const searchHowTo = vi.fn(() =>
      slowStep({
        query: 'how to roll out sso integration',
        summary:
          'Rollouts usually require provider setup, callback wiring, testing, and migration planning.',
        sources: [{ title: 'OpenAI', url: 'https://openai.com' }],
      }),
    );

    const result = await invokeEmailTaskGraph(
      {
        subject: 'This is an EPIC: SSO rollout',
        body: 'How do I roll out SSO for enterprise customers? This is an EPIC.',
      },
      {
        structuredInvoke,
        searchHowTo,
      },
    );

    expect(peakInFlight).toBe(2);
    expect(result.flags.isEpic).toBe(true);
    expect(result.flags.usedWebSearch).toBe(true);
    expect(result.searchContext?.query).toBe('how to roll out sso integration');
    expect(result.childTasks.map((task) => task.title)).toEqual([
      'Audit SSO requirements',
      'Implement SSO callback flow',
    ]);
  });

  it('falls back cleanly when web search returns nothing', async () => {
    const structuredInvoke = vi
      .fn()
      .mockResolvedValueOnce({
        isHowTo: true,
        isEpic: false,
        searchQuery: 'how to set up local staging',
      })
      .mockResolvedValueOnce(
        makeExtraction({
          parentTask: {
            title: 'Set up local staging',
            description: 'Create a local staging environment setup task.',
            priority: 'normal',
            targetStageName: 'Backlog',
          },
        }),
      );
    const searchHowTo = vi.fn().mockResolvedValue(null);

    const result = await invokeEmailTaskGraph(
      {
        subject: 'How do I set up local staging?',
        body: 'How do I set up a local staging environment that mirrors production?',
      },
      {
        structuredInvoke,
        searchHowTo,
      },
    );

    expect(searchHowTo).toHaveBeenCalledOnce();
    expect(result.searchContext).toBeNull();
    expect(result.flags.usedWebSearch).toBe(false);
    expect(result.childTasks).toEqual([]);
  });
});
