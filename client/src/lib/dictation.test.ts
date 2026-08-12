import { describe, it, expect } from 'vitest';
import { appendTranscript, formatDictatedInsertion } from './dictation';

describe('formatDictatedInsertion', () => {
  it('capitalises the phrase when nothing precedes it', () => {
    expect(formatDictatedInsertion('', 'design the homepage')).toBe('Design the homepage');
  });

  it('adds a separating space when the caret sits on a word', () => {
    expect(formatDictatedInsertion('design the', 'homepage')).toBe(' homepage');
  });

  it('does not double the space when the caret already follows one', () => {
    expect(formatDictatedInsertion('design the ', 'homepage')).toBe('homepage');
  });

  it('starts a new sentence after terminating punctuation', () => {
    expect(formatDictatedInsertion('Ship it.', 'then celebrate')).toBe(' Then celebrate');
    expect(formatDictatedInsertion('Really?', 'yes')).toBe(' Yes');
  });

  it('capitalises after whitespace-only context', () => {
    expect(formatDictatedInsertion('\n', 'new line')).toBe('New line');
  });

  it('trims the incoming phrase and ignores empty ones', () => {
    expect(formatDictatedInsertion('note', '  added  ')).toBe(' added');
    expect(formatDictatedInsertion('note', '   ')).toBe('');
  });
});

describe('appendTranscript', () => {
  it('returns the phrase capitalised for an empty field', () => {
    expect(appendTranscript('', 'call the vendor')).toBe('Call the vendor');
    expect(appendTranscript(null, 'call the vendor')).toBe('Call the vendor');
    expect(appendTranscript(undefined, 'call the vendor')).toBe('Call the vendor');
  });

  it('appends to existing text with a single space', () => {
    expect(appendTranscript('Call the vendor', 'about pricing')).toBe(
      'Call the vendor about pricing',
    );
    expect(appendTranscript('Call the vendor ', 'about pricing')).toBe(
      'Call the vendor about pricing',
    );
  });

  it('leaves the field untouched for an empty phrase', () => {
    expect(appendTranscript('Call the vendor ', '  ')).toBe('Call the vendor ');
  });
});
