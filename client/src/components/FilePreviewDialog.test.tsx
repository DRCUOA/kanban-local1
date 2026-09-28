// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FilePreviewDialog } from './FilePreviewDialog';

function renderFile(src: string, name: string, type: string) {
  return render(<FilePreviewDialog file={{ src, name, type }} onOpenChange={vi.fn()} />);
}

describe('FilePreviewDialog', () => {
  it('previews images inline', () => {
    renderFile('/api/attachments/3', 'shot.png', 'image/png');
    expect(screen.getByTestId('img-file-preview').getAttribute('src')).toBe('/api/attachments/3');
  });

  it('frames PDFs and plain text, and plays audio and video', () => {
    const { unmount } = renderFile('/api/attachments/4', 'report.pdf', 'application/pdf');
    expect(screen.getByTestId('frame-file-preview').getAttribute('src')).toBe('/api/attachments/4');
    unmount();

    const text = renderFile('/api/attachments/5', 'notes.txt', 'text/plain');
    expect(screen.getByTestId('frame-file-preview')).toBeTruthy();
    text.unmount();

    const audio = renderFile('/api/attachments/6', 'memo.m4a', 'audio/mp4');
    expect(screen.getByTestId('audio-file-preview')).toBeTruthy();
    audio.unmount();

    renderFile('/api/attachments/7', 'clip.mp4', 'video/mp4');
    expect(screen.getByTestId('video-file-preview')).toBeTruthy();
  });

  it('offers other files as a download only, through the download url', () => {
    renderFile(
      '/api/attachments/8',
      'plan.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(screen.queryByTestId('img-file-preview')).toBeNull();
    expect(screen.queryByTestId('frame-file-preview')).toBeNull();
    expect(screen.getByText('No inline preview for this file.')).toBeTruthy();
    const link = screen.getByTestId('link-file-download');
    expect(link.getAttribute('href')).toBe('/api/attachments/8?download=1');
    expect(link.getAttribute('download')).toBe('plan.docx');
  });
});
