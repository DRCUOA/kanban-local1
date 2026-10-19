// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { VoiceInput } from './VoiceInput';

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }
}

describe('VoiceInput', () => {
  beforeEach(() => {
    MockSpeechRecognition.instances = [];
    Object.defineProperty(globalThis, 'SpeechRecognition', {
      value: MockSpeechRecognition,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'SpeechRecognition');
  });

  it('stops dictation when the field blurs', () => {
    const onBlur = vi.fn();

    render(
      <VoiceInput
        aria-label="Task title"
        defaultValue=""
        onDictate={vi.fn()}
        fieldLabel="title"
        onBlur={onBlur}
      />,
    );

    fireEvent.click(screen.getByLabelText('Dictate title'));
    const recognition = MockSpeechRecognition.instances.at(-1);
    if (!recognition) throw new Error('Speech recognition was not constructed');
    expect(recognition.start).toHaveBeenCalledTimes(1);

    fireEvent.blur(screen.getByRole('textbox'));

    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
