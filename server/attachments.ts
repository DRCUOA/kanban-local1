import type { IStorage } from './storage';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_ORPHAN_TTL_MS,
  attachmentUrl,
  listFileChips,
  parseAttachmentUrl,
  parseBase64DataUrl,
  resolveAttachmentType,
  rewriteFileChips,
  sanitizeAttachmentFilename,
} from '@shared/attachments';
import { logger } from '@shared/logger';

export interface PreparedDescription {
  /** The description with every chip pointing at an attachment url. */
  description: string;
  /** The attachments the description now references. */
  attachmentIds: number[];
}

/**
 * Bring a description's file chips into line with `task_attachments` before
 * the description is saved:
 * - a chip still carrying its file inline (a `data:` URL: descriptions written
 *   before attachments had rows, and import files from then) is stored as a
 *   row and re-pointed at that row's url;
 * - a chip pointing at another task's attachment (a description pasted from
 *   one task into another) gets a copy of its own, so deleting either task
 *   never breaks the other;
 * - a chip whose file is unknown, of a type that can't be attached or too
 *   large loses its href rather than keeping a dead or unsafe one.
 *
 * `taskId` is null when the task does not exist yet; the ids returned are for
 * `syncTaskAttachments` once it does.
 */
export async function prepareDescriptionAttachments(
  store: IStorage,
  description: string,
  taskId: number | null,
): Promise<PreparedDescription> {
  if (!description.includes('data-file-chip')) return { description, attachmentIds: [] };

  // Resolve every referenced row in one query before rewriting.
  const referenced = listFileChips(description)
    .map((chip) => parseAttachmentUrl(chip.href))
    .filter((id): id is number => id !== null);
  const known = new Map((await store.getAttachmentsMeta(referenced)).map((a) => [a.id, a]));

  const ids = new Set<number>();
  const rewritten = await rewriteFileChips(description, async (chip) => {
    const id = parseAttachmentUrl(chip.href);
    if (id !== null) {
      const meta = known.get(id);
      if (!meta) {
        logger.warn(`Description references attachment ${id}, which no longer exists`);
        return null;
      }
      if (meta.taskId === null || meta.taskId === taskId) {
        ids.add(id);
        return undefined;
      }
      const copy = await store.copyAttachment(id);
      if (!copy) return null;
      ids.add(copy.id);
      return attachmentUrl(copy.id);
    }

    const inline = parseBase64DataUrl(chip.href);
    if (!inline) return undefined;
    const filename = sanitizeAttachmentFilename(chip.name);
    const mimeType = resolveAttachmentType(filename, inline.mimeType || chip.type);
    const data = Buffer.from(inline.base64, 'base64');
    if (!mimeType || data.length === 0 || data.length > ATTACHMENT_MAX_BYTES) {
      logger.warn(
        `Dropping inline attachment "${filename}" (${inline.mimeType || 'no type'}, ${data.length} bytes)`,
      );
      return null;
    }
    const stored = await store.createAttachment({ taskId, filename, mimeType, data });
    ids.add(stored.id);
    return attachmentUrl(stored.id);
  });

  return { description: rewritten, attachmentIds: [...ids] };
}

/**
 * Bind the attachments a saved description references to its task and, for
 * a rewrite, release the ones it no longer references (the sweeper deletes
 * those once they are a day old, so an undone edit is not an instant loss).
 */
export async function syncTaskAttachments(
  store: IStorage,
  taskId: number,
  attachmentIds: number[],
  options: { release: boolean },
): Promise<void> {
  if (attachmentIds.length > 0) await store.bindAttachments(taskId, attachmentIds);
  if (options.release) await store.releaseAttachments(taskId, attachmentIds);
}

/**
 * Data migration, run at startup and safe to repeat: moves the files that
 * descriptions written before `task_attachments` still carry inline into
 * rows. A description that holds only urls no longer matches, so a second
 * run finds nothing to do. Returns how many tasks were rewritten.
 */
export async function extractInlineAttachments(store: IStorage): Promise<number> {
  const ids = await store.getTaskIdsWithInlineAttachments();
  let rewritten = 0;
  for (const id of ids) {
    const task = await store.getTaskById(id);
    if (!task?.description) continue;
    const prepared = await prepareDescriptionAttachments(store, task.description, id);
    if (prepared.description === task.description) continue;
    await store.setTaskDescription(id, prepared.description);
    await syncTaskAttachments(store, id, prepared.attachmentIds, { release: false });
    rewritten++;
  }
  if (rewritten > 0) {
    logger.info(`Moved inline attachments out of ${rewritten} task description(s)`);
  }
  return rewritten;
}

/** Deletes attachments no saved description has referenced for a day. */
export async function sweepOrphanAttachments(store: IStorage, now = new Date()): Promise<number> {
  const olderThan = new Date(now.getTime() - ATTACHMENT_ORPHAN_TTL_MS);
  const deleted = await store.deleteOrphanAttachments(olderThan);
  if (deleted > 0) logger.info(`Swept ${deleted} unreferenced attachment(s)`);
  return deleted;
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/** Sweeps now and then hourly. The timer never keeps the process alive. */
export function startAttachmentSweeper(store: IStorage): NodeJS.Timeout {
  const run = () => {
    sweepOrphanAttachments(store).catch((error: unknown) => {
      logger.error('Attachment sweep failed:', error);
    });
  };
  run();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

/**
 * `Content-Disposition` for a file name that may hold anything: an ASCII
 * fallback for old clients plus the RFC 5987 UTF-8 form modern ones read.
 */
export function contentDispositionHeader(kind: 'inline' | 'attachment', filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
