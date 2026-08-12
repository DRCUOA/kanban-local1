import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@shared/logger';

/**
 * Voice dictation via the browser's Web Speech API.
 *
 * On macOS this is the OS speech stack: Safari routes `SpeechRecognition`
 * through Apple's own recogniser (the same one behind System Settings →
 * Keyboard → Dictation) and prompts for the standard microphone permission.
 * Chrome/Edge expose the same API under the `webkit` prefix.
 *
 * Browsers without the API (notably Firefox) report `supported: false`; callers
 * fall back to macOS Dictation itself — see `MACOS_DICTATION_HINT`.
 */

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Human-readable message for the error codes the spec defines. */
function describeError(code: string): string | null {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow it for this site in your browser settings.';
    case 'audio-capture':
      return 'No microphone was found. Check your input device and try again.';
    case 'network':
      return 'Speech recognition could not reach the network service.';
    case 'no-speech':
    case 'aborted':
      // Routine end-of-dictation conditions, not worth interrupting the user.
      return null;
    default:
      return 'Dictation stopped unexpectedly. Please try again.';
  }
}

export interface UseSpeechDictationOptions {
  /** Called with each finalised phrase. Interim results never reach this. */
  onFinal: (transcript: string) => void;
  /** Surfaced when dictation fails in a way the user should know about. */
  onError?: (message: string) => void;
  /** BCP-47 tag; defaults to the browser/OS language. */
  lang?: string;
}

export interface SpeechDictation {
  /** False when the browser has no Web Speech API at all. */
  supported: boolean;
  listening: boolean;
  /** Words heard but not yet finalised — for live feedback only. */
  interim: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useSpeechDictation({
  onFinal,
  onError,
  lang,
}: UseSpeechDictationOptions): SpeechDictation {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Handlers are read through refs so a re-render never rebinds a live session.
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);
  onFinalRef.current = onFinal;
  onErrorRef.current = onError;

  const supported = getRecognitionCtor() !== null;

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognitionRef.current = null;
    setListening(false);
    setInterim('');
    try {
      recognition.stop();
    } catch (error) {
      logger.warn('Failed to stop speech recognition', error);
    }
  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang ?? navigator.language;

    recognition.onresult = (event) => {
      let pending = '';
      // resultIndex marks the first result that changed; earlier ones are
      // already committed, so re-reading them would duplicate text.
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          if (transcript.trim().length > 0) onFinalRef.current(transcript);
        } else {
          pending += transcript;
        }
      }
      setInterim(pending);
    };

    recognition.onerror = (event) => {
      const message = describeError(event.error);
      if (message) onErrorRef.current?.(message);
      // 'no-speech' and friends are followed by onend, which clears state.
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (error) {
      logger.warn('Failed to start speech recognition', error);
      onErrorRef.current?.('Dictation could not be started.');
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (recognitionRef.current) stop();
    else start();
  }, [start, stop]);

  // A recogniser left running after unmount keeps the mic indicator lit.
  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  return { supported, listening, interim, start, stop, toggle };
}
