import { describe, expect, it } from 'vitest';
import { extractTriggeredMessageIds } from './history-sync';

describe('extractTriggeredMessageIds', () => {
  it('collects message ids from both messageAdded and labelAdded events', () => {
    expect(
      extractTriggeredMessageIds([
        {
          messagesAdded: [{ message: { id: 'msg-1' } }],
        },
        {
          labelsAdded: [{ message: { id: 'msg-2' } }],
        },
      ]),
    ).toEqual(['msg-1', 'msg-2']);
  });

  it('deduplicates ids that appear across multiple history events', () => {
    expect(
      extractTriggeredMessageIds([
        {
          messagesAdded: [{ message: { id: 'msg-1' } }],
          labelsAdded: [{ message: { id: 'msg-1' } }],
        },
        {
          labelsAdded: [{ message: { id: 'msg-1' } }, { message: { id: 'msg-2' } }],
        },
      ]),
    ).toEqual(['msg-1', 'msg-2']);
  });
});
