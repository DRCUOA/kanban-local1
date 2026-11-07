// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { RichTextEditor } from './RichTextEditor';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const apiPostMock = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiPost: (url: string, body: unknown) => apiPostMock(url, body) as unknown };
});

// jsdom has no layout. Replace focuses the editor, and ProseMirror then asks a
// Range for its rectangles to scroll the selection into view.
const noRect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => ({ ...noRect, toJSON: () => noRect }) as DOMRect;

function renderEditor(value: string, polish = true) {
  const onChange = vi.fn();
  render(<RichTextEditor value={value} onChange={onChange} polish={polish} />);
  return { onChange };
}

describe('DescriptionPolishButton', () => {
  beforeEach(() => {
    apiPostMock.mockReset();
  });

  it('is only in the toolbar when the editor asks for it', () => {
    renderEditor('<p>Hello</p>', false);
    expect(screen.queryByLabelText('Polish with AI')).toBeNull();
  });

  it('sends the description and instruction, shows the suggestion, and Replace puts it in the editor', async () => {
    apiPostMock.mockResolvedValue({ html: '<p>Hello, world.</p>', filesMovedToEnd: 0, model: 'm' });
    const { onChange } = renderEditor('<p>helo wrld</p>');

    fireEvent.click(screen.getByLabelText('Polish with AI'));
    fireEvent.click(await screen.findByRole('button', { name: 'Fix spelling' }));

    expect(apiPostMock).toHaveBeenCalledWith('/api/ai/polish', {
      html: '<p>helo wrld</p>',
      instruction: 'Fix spelling, grammar and punctuation only. Change nothing else.',
    });
    expect((await screen.findByTestId('polish-suggestion')).innerHTML).toBe('<p>Hello, world.</p>');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('button-polish-replace'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('<p>Hello, world.</p>');
    });
    expect(screen.queryByTestId('popover-polish-description')).toBeNull();
  });

  it('refines the suggestion, not the original, with a typed instruction', async () => {
    apiPostMock
      .mockResolvedValueOnce({ html: '<p>Draft two</p>', filesMovedToEnd: 0, model: 'm' })
      .mockResolvedValueOnce({ html: '<p>Draft three</p>', filesMovedToEnd: 0, model: 'm' });
    renderEditor('<p>draft one</p>');

    fireEvent.click(screen.getByLabelText('Polish with AI'));
    fireEvent.click(await screen.findByRole('button', { name: 'Polish' }));
    await screen.findByTestId('polish-suggestion');

    const input = screen.getByTestId('input-polish-instruction');
    fireEvent.change(input, { target: { value: 'Make it louder' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('polish-suggestion').innerHTML).toBe('<p>Draft three</p>');
    });
    expect(apiPostMock).toHaveBeenLastCalledWith('/api/ai/polish', {
      html: '<p>Draft two</p>',
      instruction: 'Make it louder',
    });
  });

  it('shows the server message when the call fails and leaves the editor alone', async () => {
    const { ApiError } = await import('@/lib/api');
    apiPostMock.mockRejectedValue(new ApiError(400, 'Bad Request', 'No OpenAI API key is set.'));
    const { onChange } = renderEditor('<p>Text</p>');

    fireEvent.click(screen.getByLabelText('Polish with AI'));
    fireEvent.click(await screen.findByRole('button', { name: 'Shorten' }));

    await waitFor(() => {
      expect(screen.getByTestId('polish-status').textContent).toBe('No OpenAI API key is set.');
    });
    expect(screen.queryByTestId('polish-suggestion')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables nothing while waiting, so focus stays in the popover and it stays open', async () => {
    // A focused control that becomes `disabled` drops focus to the page; the
    // task dialog's focus trap then took it, and the popover closed on the
    // answer. Seen in Chrome on 7 Nov 2026; this pins the cause.
    let answer: (value: unknown) => void = () => undefined;
    apiPostMock.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderEditor('<p>Text</p>');

    fireEvent.click(screen.getByLabelText('Polish with AI'));
    fireEvent.click(await screen.findByRole('button', { name: 'Shorten' }));

    const popover = await screen.findByTestId('popover-polish-description');
    expect(screen.getByTestId('polish-status').textContent).toBe('Rewriting the description…');
    expect(popover.querySelectorAll(':disabled')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Shorten' }).getAttribute('aria-disabled')).toBe(
      'true',
    );

    answer({ html: '<p>Short</p>', filesMovedToEnd: 0, model: 'm' });
    expect((await screen.findByTestId('polish-suggestion')).innerHTML).toBe('<p>Short</p>');
  });

  it('asks for some words first when the description is empty', async () => {
    renderEditor('');
    fireEvent.click(screen.getByLabelText('Polish with AI'));
    expect(await screen.findByText(/Write something in the description first/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Polish' })).toBeNull();
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});
