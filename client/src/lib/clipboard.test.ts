// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { copyToClipboard } from './clipboard';

/** jsdom has no `execCommand`, and the type marks it deprecated. */
function stubExecCommand(implementation: () => boolean) {
  Object.assign(document, { execCommand: vi.fn(implementation) });
}

describe('copyToClipboard — execCommand fallback', () => {
  let copied: { value: string; parent: Element | null; focused: Element | null }[];

  beforeEach(() => {
    copied = [];
    // The async API is denied, as it is in a non-secure context.
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    stubExecCommand(() => {
      const textarea = document.querySelector('textarea');
      copied.push({
        value: textarea?.value ?? '',
        parent: textarea?.parentElement ?? null,
        focused: document.activeElement,
      });
      return true;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('selects the text in the body when nothing traps focus', async () => {
    await expect(copyToClipboard({ text: 'hello' })).resolves.toBe(true);

    expect(copied).toHaveLength(1);
    expect(copied[0]?.value).toBe('hello');
    expect(copied[0]?.parent).toBe(document.body);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('selects the text inside a modal dialog, whose focus trap would otherwise take it away', async () => {
    document.body.innerHTML = '<div role="dialog"><button id="copy">Copy</button></div>';
    const dialog = document.querySelector('[role="dialog"]');
    const button = document.getElementById('copy');
    button?.focus();

    await expect(copyToClipboard({ text: 'hello' })).resolves.toBe(true);

    expect(copied[0]?.parent).toBe(dialog);
    expect(copied[0]?.focused?.tagName).toBe('TEXTAREA');
    expect(document.querySelector('textarea')).toBeNull();
    // Focus goes back to the button that was pressed.
    expect(document.activeElement).toBe(button);
  });

  it('reports failure when the browser refuses', async () => {
    stubExecCommand(() => false);

    await expect(copyToClipboard({ text: 'hello' })).resolves.toBe(false);
  });
});
