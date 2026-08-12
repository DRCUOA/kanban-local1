/**
 * Helpers for voice dictation into task fields.
 *
 * The speech engine hands back bare phrases ("design the homepage") with no
 * knowledge of what is already in the field, so these helpers own the join:
 * spacing and sentence capitalisation.
 */

/** Sentence-ending punctuation after which the next phrase starts a new sentence. */
const SENTENCE_END = /[.!?]["')\]]?$/;

/** Capitalise the first letter, leaving the rest of the phrase untouched. */
function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The text to insert at a caret, given whatever precedes it.
 *
 * Adds a separating space unless the caret already sits after whitespace (or at
 * the very start), and capitalises the phrase when it opens a sentence.
 */
export function formatDictatedInsertion(precedingText: string, addition: string): string {
  const phrase = addition.trim();
  if (phrase.length === 0) return '';
  if (precedingText.length === 0) return capitalizeFirst(phrase);

  const trimmed = precedingText.replace(/\s+$/, '');
  const startsSentence = trimmed.length === 0 || SENTENCE_END.test(trimmed);
  const body = startsSentence ? capitalizeFirst(phrase) : phrase;
  return /\s$/.test(precedingText) ? body : ` ${body}`;
}

/** Join a dictated phrase onto the end of a field's current value. */
export function appendTranscript(existing: string | null | undefined, addition: string): string {
  const base = existing ?? '';
  return base + formatDictatedInsertion(base, addition);
}

/**
 * The macOS-native fallback shown when the browser has no Web Speech API.
 * macOS Dictation types straight into the focused field, so the field is
 * focused for the user and this tells them the shortcut.
 */
export const MACOS_DICTATION_HINT =
  'Voice dictation is not available in this browser. Use macOS Dictation instead: with the field focused, press the Dictation key (or Fn Fn / Control Control).';
