import { describe, expect, it } from 'vitest';
import {
  applySubjectDirectives,
  extractionMode,
  firstLineOf,
  parseSubjectDirectives,
  plainExtraction,
} from './extraction';

describe('parseSubjectDirectives', () => {
  it('reads !priority and @stage anywhere, the last of each winning, and takes them out of the title', () => {
    expect(parseSubjectDirectives('Book the dentist !high @in-progress')).toEqual({
      title: 'Book the dentist',
      priority: 'high',
      stageName: 'in progress',
    });
    expect(parseSubjectDirectives('!low Fix the gate !CRITICAL @Backlog')).toEqual({
      title: 'Fix the gate',
      priority: 'critical',
      stageName: 'Backlog',
    });
    expect(parseSubjectDirectives('@waiting_on_others Chase the quote')).toEqual({
      title: 'Chase the quote',
      priority: null,
      stageName: 'waiting on others',
    });
  });

  it('leaves alone a !word that is no priority and an address’s @', () => {
    expect(parseSubjectDirectives('Call rich@example.com !urgent')).toEqual({
      title: 'Call rich@example.com !urgent',
      priority: null,
      stageName: null,
    });
    expect(parseSubjectDirectives('')).toEqual({ title: '', priority: null, stageName: null });
  });
});

describe('plainExtraction', () => {
  it('is one task: subject as title, body as description, directives applied', () => {
    expect(plainExtraction('Book the dentist !high @in-progress', 'Soon.\n')).toEqual({
      parentTask: {
        title: 'Book the dentist',
        description: 'Soon.',
        priority: 'high',
        targetStageName: 'in progress',
      },
      childTasks: [],
      flags: { isEpic: false, usedWebSearch: false },
      searchContext: null,
    });
  });

  it('titles a message with no subject from its first line, and the empty one by name', () => {
    expect(plainExtraction('', '\nFix the gate\nIt sticks.').parentTask).toMatchObject({
      title: 'Fix the gate',
      description: 'Fix the gate\nIt sticks.',
    });
    expect(plainExtraction('', '').parentTask).toEqual({
      title: '(no subject)',
      description: null,
      priority: null,
      targetStageName: null,
    });
    expect(firstLineOf('\n  \n  second  \nthird')).toBe('second');
  });
});

describe('applySubjectDirectives', () => {
  const extraction = plainExtraction('Anything', 'body');
  const inferred = {
    ...extraction,
    parentTask: { ...extraction.parentTask, priority: 'low' as const, targetStageName: 'Backlog' },
  };

  it('lets what the subject said override what the model inferred, and only that', () => {
    expect(
      applySubjectDirectives(inferred, { title: 'x', priority: 'high', stageName: null })
        .parentTask,
    ).toMatchObject({ priority: 'high', targetStageName: 'Backlog' });
    expect(
      applySubjectDirectives(inferred, { title: 'x', priority: null, stageName: 'Doing' })
        .parentTask,
    ).toMatchObject({ priority: 'low', targetStageName: 'Doing' });
    expect(applySubjectDirectives(inferred, { title: 'x', priority: null, stageName: null })).toBe(
      inferred,
    );
  });
});

describe('extractionMode', () => {
  it('is what INBOX_EXTRACTION says, else the model when a key is set, else plain', () => {
    expect(extractionMode({ INBOX_EXTRACTION: 'plain', OPENAI_API_KEY: 'sk-x' })).toBe('plain');
    expect(extractionMode({ INBOX_EXTRACTION: ' LLM ' })).toBe('llm');
    expect(extractionMode({ INBOX_EXTRACTION: 'nonsense', OPENAI_API_KEY: 'sk-x' })).toBe('llm');
    expect(extractionMode({ OPENAI_API_KEY: '  ' })).toBe('plain');
    expect(extractionMode({})).toBe('plain');
  });
});
