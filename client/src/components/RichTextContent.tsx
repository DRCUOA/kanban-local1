import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toRichHtml, openFileChip } from '@/lib/rich-text';

interface RichTextContentProps {
  value: string | null | undefined;
  className?: string;
}

/**
 * Read-only renderer for task descriptions. Sanitizes stored HTML (or wraps
 * legacy plain text), opens links in a new tab and file chips via object URLs.
 * Non-link clicks bubble up, so cards can still open their edit dialog.
 */
export function RichTextContent({ value, className }: RichTextContentProps) {
  const html = useMemo(() => toRichHtml(value), [value]);

  if (!html) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;
    e.preventDefault();
    e.stopPropagation();
    if (anchor.hasAttribute('data-file-chip')) {
      openFileChip(anchor.getAttribute('href'), anchor.getAttribute('data-file-name'));
      return;
    }
    const href = anchor.getAttribute('href');
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={cn('rich-text', className)}
      onClick={handleClick}
      // Sanitized via DOMPurify in toRichHtml.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
