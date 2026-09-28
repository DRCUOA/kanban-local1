import type { UploadedAttachmentResponse } from '@shared/api-types';
import { api } from '@shared/routes';
import {
  ATTACHMENT_NAME_HEADER,
  ATTACHMENT_TYPE_HEADER,
  parseAttachmentUrl,
  rewriteFileChips,
} from '@shared/attachments';
import type { ExportAttachment } from '@shared/export';
import { apiUpload } from '@/lib/api';

/**
 * Upload a file. The row is bound to a task once a description referencing
 * the returned `url` is saved; an upload never saved is swept after a day.
 */
export function uploadAttachment(
  file: Blob,
  name: string,
  type: string,
): Promise<UploadedAttachmentResponse> {
  return apiUpload<UploadedAttachmentResponse>(api.attachments.upload.path, file, {
    'Content-Type': 'application/octet-stream',
    [ATTACHMENT_TYPE_HEADER]: type,
    [ATTACHMENT_NAME_HEADER]: encodeURIComponent(name),
  });
}

/** The url that downloads an attachment instead of showing it. */
export function attachmentDownloadUrl(src: string): string {
  return parseAttachmentUrl(src) === null ? src : `${src}?download=1`;
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Point an imported description's file chips at this board's own rows: a
 * chip whose file the export carries is uploaded here and re-pointed at the
 * upload; one whose file the export lacks loses its href. A chip that still
 * holds its file inline (an export from before attachments had rows) is left
 * for the server to store on save.
 */
export async function importDescriptionAttachments(
  description: string,
  attachments: Map<number, ExportAttachment>,
): Promise<string> {
  if (!description.includes('data-file-chip')) return description;
  return rewriteFileChips(description, async (chip) => {
    const id = parseAttachmentUrl(chip.href);
    if (id === null) return undefined;
    const source = attachments.get(id);
    if (!source?.data) return null;
    const uploaded = await uploadAttachment(
      base64ToBlob(source.data, source.mimeType),
      source.filename,
      source.mimeType,
    );
    return uploaded.url;
  });
}
