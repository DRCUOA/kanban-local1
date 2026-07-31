import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
 * In-app preview for description file chips. Images render inline; anything
 * else falls back to a download link. `src` is a sanitized data URL.
 */
export function FilePreviewDialog({ file, onOpenChange }: FilePreviewDialogProps) {
  const isImage = Boolean(file?.type.startsWith('image/') && file.src.startsWith('data:image/'));

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
        {file && isImage ? (
          <img
            src={file.src}
            alt={file.name}
            className="max-h-[70vh] w-auto max-w-full mx-auto rounded-lg object-contain"
            data-testid="img-file-preview"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No inline preview for this file.</p>
        )}
        {file && (
          <Button asChild variant="outline" className="h-11 rounded-xl w-full gap-2">
            <a href={file.src} download={file.name}>
              <Download className="h-4 w-4" />
              Download
            </a>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
