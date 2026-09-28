import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { attachmentPreviewKind } from '@shared/attachments';
import { attachmentDownloadUrl } from '@/lib/attachments';

export interface PreviewFile {
  src: string;
  name: string;
  type: string;
}

interface FilePreviewDialogProps {
  file: PreviewFile | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * In-app preview for description file chips. `src` is the attachment's
 * sanitized same-origin url: images, PDFs, audio, video and plain text show
 * inline; anything else offers the download only.
 */
export function FilePreviewDialog({ file, onOpenChange }: FilePreviewDialogProps) {
  const kind = file ? attachmentPreviewKind(file.type) : 'none';

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-2xl p-4 rounded-2xl"
        data-testid="dialog-file-preview"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-medium truncate pr-8">
            {file?.name ?? 'Attachment'}
          </DialogTitle>
        </DialogHeader>
        {file && kind === 'image' && (
          <img
            src={file.src}
            alt={file.name}
            className="max-h-[70vh] w-auto max-w-full mx-auto rounded-lg object-contain"
            data-testid="img-file-preview"
          />
        )}
        {file && (kind === 'pdf' || kind === 'text') && (
          <iframe
            src={file.src}
            title={file.name}
            className="h-[70vh] w-full rounded-lg border border-border bg-background"
            data-testid="frame-file-preview"
          />
        )}
        {file && kind === 'audio' && (
          <audio controls src={file.src} className="w-full" data-testid="audio-file-preview" />
        )}
        {file && kind === 'video' && (
          <video
            controls
            src={file.src}
            className="max-h-[70vh] w-full rounded-lg bg-black"
            data-testid="video-file-preview"
          />
        )}
        {file && kind === 'none' && (
          <p className="text-sm text-muted-foreground">No inline preview for this file.</p>
        )}
        {file && (
          <Button asChild variant="outline" className="h-11 rounded-xl w-full gap-2">
            <a
              href={attachmentDownloadUrl(file.src)}
              download={file.name}
              data-testid="link-file-download"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
