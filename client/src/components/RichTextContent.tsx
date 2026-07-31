import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { toRichHtml } from '@/lib/rich-text';
import { FilePreviewDialog, type PreviewFile } from '@/components/FilePreviewDialog';

interface RichTextContentProps {
  value: string | null | undefined;
  className?: string;
  'data-testid'?: string;
}

/**
 * Read-only renderer for task descriptions. Sanitizes stored HTML (or wraps
 * legacy plain text). Links open in a new tab; file chips open an in-app
 * preview modal. Non-link clicks bubble up, so cards can still open their
 * edit dialog.
 */
export function RichTextContent({ value, className, 'data-testid': testId }: RichTextContentProps) {
  const html = useMemo(() => toRichHtml(value), [value]);
  const [preview, setPreview] = useState<PreviewFile | null>(null);

  if (!html) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;
    e.preventDefault();
    e.stopPropagation();
    if (anchor.hasAttribute('data-file-chip')) {
      const src = anchor.getAttribute('href');
      if (src) {
        setPreview({
          src,
          name: anchor.getAttribute('data-file-name') ?? 'attachment',
          type: anchor.getAttribute('data-file-type') ?? '',
        });
      }
      return;
    }
    const href = anchor.getAttribute('href');
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <div
        className={cn('rich-text', className)}
        onClick={handleClick}
        data-testid={testId}
        // Sanitized via DOMPurify in toRichHtml.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {preview && (
        // Portal events bubble through the React tree — without this stop, a
        // click inside the preview would reach the host card and open its
        // edit dialog.
        <span
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <FilePreviewDialog
            file={preview}
            onOpenChange={(open) => {
              if (!open) setPreview(null);
            }}
          />
        </span>
      )}
    </>
  );
}
