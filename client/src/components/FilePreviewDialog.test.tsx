// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FilePreviewDialog } from './FilePreviewDialog';

const downloadBlobMock = vi.fn();
vi.mock('@/lib/save-file', () => ({
  downloadBlob: (filename: string, blob: Blob) => {
    downloadBlobMock(filename, blob);
  },
}));

describe('FilePreviewDialog', () => {
  beforeEach(() => {
    downloadBlobMock.mockClear();
  });

  it('previews images inline', () => {
    render(
      <FilePreviewDialog
        file={{ src: 'data:image/png;base64,AAAA', name: 'shot.png', type: 'image/png' }}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('img-file-preview')).toBeTruthy();
  });

  it('downloads other files through a Blob rather than the data: href', async () => {
    render(
      <FilePreviewDialog
        file={{
          src: 'data:application/pdf;base64,JVBERi0=',
          name: 'report.pdf',
          type: 'application/pdf',
        }}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('img-file-preview')).toBeNull();

    fireEvent.click(screen.getByTestId('link-file-download'));

    expect(downloadBlobMock).toHaveBeenCalledOnce();
    const [filename, blob] = downloadBlobMock.mock.calls[0] as [string, Blob];
    expect(filename).toBe('report.pdf');
    expect(blob.type).toBe('application/pdf');
    expect(await blob.text()).toBe('%PDF-');
  });
});
