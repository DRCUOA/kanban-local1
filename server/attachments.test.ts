import { describe, it, expect, vi } from 'vitest';
import type { IStorage } from './storage';
import type { Task, TaskAttachment } from '@shared/schema';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_ORPHAN_TTL_MS } from '@shared/attachments';
import {
  contentDispositionHeader,
  extractInlineAttachments,
  prepareDescriptionAttachments,
  sweepOrphanAttachments,
  syncTaskAttachments,
} from './attachments';

const NOW = new Date('2026-09-28T12:00:00Z');

function meta(overrides: Partial<TaskAttachment> = {}): TaskAttachment {
  return {
    id: 1,
    taskId: null,
    filename: 'f.png',
    mimeType: 'image/png',
    byteSize: 3,
    createdAt: NOW,
    ...overrides,
  };
}

function fakeStore() {
  const store = {
    getAttachmentsMeta: vi.fn().mockResolvedValue([]),
    createAttachment: vi.fn(),
    copyAttachment: vi.fn(),
    bindAttachments: vi.fn().mockResolvedValue([]),
    releaseAttachments: vi.fn().mockResolvedValue(undefined),
    deleteOrphanAttachments: vi.fn().mockResolvedValue(0),
    getTaskIdsWithInlineAttachments: vi.fn().mockResolvedValue([]),
    getTaskById: vi.fn(),
    setTaskDescription: vi.fn().mockResolvedValue(undefined),
  };
  return { store, storage: store as unknown as IStorage };
}

const chip = (href: string, name = 'f.png', type = 'image/png') =>
  `<a data-file-chip="" data-file-name="${name}" data-file-type="${type}" href="${href}" class="file-chip">${name}</a>`;

// "AAAA" decodes to three zero bytes.
const THREE_ZEROS = Buffer.from([0, 0, 0]);

describe('prepareDescriptionAttachments', () => {
  it('leaves a description without chips alone and touches no storage', async () => {
    const { store, storage } = fakeStore();
    const result = await prepareDescriptionAttachments(storage, '<p>hi</p>', null);
    expect(result).toEqual({ description: '<p>hi</p>', attachmentIds: [] });
    expect(store.getAttachmentsMeta).not.toHaveBeenCalled();
  });

  it('stores a file a chip still holds inline as a row and points the chip at it', async () => {
    const { store, storage } = fakeStore();
    store.createAttachment.mockResolvedValue(meta({ id: 7 }));

    const result = await prepareDescriptionAttachments(
      storage,
      `<p>${chip('data:image/png;base64,AAAA')}</p>`,
      null,
    );

    expect(result.description).toBe(`<p>${chip('/api/attachments/7')}</p>`);
    expect(result.attachmentIds).toEqual([7]);
    expect(store.createAttachment).toHaveBeenCalledWith({
      taskId: null,
      filename: 'f.png',
      mimeType: 'image/png',
      data: THREE_ZEROS,
    });
  });

  it('types an inline file from its name when the data url has an unusable type', async () => {
    const { store, storage } = fakeStore();
    store.createAttachment.mockResolvedValue(meta({ id: 7, mimeType: 'text/markdown' }));

    await prepareDescriptionAttachments(
      storage,
      chip('data:application/octet-stream;base64,AAAA', 'notes.md', ''),
      4,
    );

    expect(store.createAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 4, filename: 'notes.md', mimeType: 'text/markdown' }),
    );
  });

  it('drops the href of an inline file that cannot be attached', async () => {
    const { store, storage } = fakeStore();
    const result = await prepareDescriptionAttachments(
      storage,
      chip('data:text/html;base64,AAAA', 'page.html', 'text/html'),
      null,
    );
    expect(result.description).not.toContain('href');
    expect(result.attachmentIds).toEqual([]);
    expect(store.createAttachment).not.toHaveBeenCalled();
  });

  it('drops an inline file over the size limit', async () => {
    const { store, storage } = fakeStore();
    const tooBig = Buffer.alloc(ATTACHMENT_MAX_BYTES + 1).toString('base64');
    const result = await prepareDescriptionAttachments(
      storage,
      chip(`data:image/png;base64,${tooBig}`),
      null,
    );
    expect(result.description).not.toContain('href');
    expect(store.createAttachment).not.toHaveBeenCalled();
  });

  it('keeps chips pointing at unbound or own attachments and reports their ids', async () => {
    const { store, storage } = fakeStore();
    store.getAttachmentsMeta.mockResolvedValue([
      meta({ id: 5, taskId: null }),
      meta({ id: 6, taskId: 3 }),
    ]);
    const html = `<p>${chip('/api/attachments/5')} ${chip('/api/attachments/6')}</p>`;

    const result = await prepareDescriptionAttachments(storage, html, 3);

    expect(result.description).toBe(html);
    expect(result.attachmentIds).toEqual([5, 6]);
    expect(store.getAttachmentsMeta).toHaveBeenCalledWith([5, 6]);
    expect(store.copyAttachment).not.toHaveBeenCalled();
  });

  it("gives a chip pointing at another task's attachment a copy of its own", async () => {
    const { store, storage } = fakeStore();
    store.getAttachmentsMeta.mockResolvedValue([meta({ id: 5, taskId: 2 })]);
    store.copyAttachment.mockResolvedValue(meta({ id: 8 }));

    const result = await prepareDescriptionAttachments(storage, chip('/api/attachments/5'), 3);

    expect(result.description).toBe(chip('/api/attachments/8'));
    expect(result.attachmentIds).toEqual([8]);
    expect(store.copyAttachment).toHaveBeenCalledWith(5);
  });

  it('removes the href of a chip whose attachment no longer exists', async () => {
    const { storage } = fakeStore();
    const result = await prepareDescriptionAttachments(storage, chip('/api/attachments/5'), 3);
    expect(result.description).not.toContain('href');
    expect(result.attachmentIds).toEqual([]);
  });

  it('leaves chips with any other href alone', async () => {
    const { store, storage } = fakeStore();
    const html = chip('https://example.com/x.png');
    const result = await prepareDescriptionAttachments(storage, html, 3);
    expect(result.description).toBe(html);
    expect(store.createAttachment).not.toHaveBeenCalled();
  });
});

describe('syncTaskAttachments', () => {
  it('binds the referenced ids and releases the rest only when asked', async () => {
    const { store, storage } = fakeStore();
    await syncTaskAttachments(storage, 3, [5, 6], { release: false });
    expect(store.bindAttachments).toHaveBeenCalledWith(3, [5, 6]);
    expect(store.releaseAttachments).not.toHaveBeenCalled();

    await syncTaskAttachments(storage, 3, [], { release: true });
    expect(store.bindAttachments).toHaveBeenCalledTimes(1);
    expect(store.releaseAttachments).toHaveBeenCalledWith(3, []);
  });
});

describe('extractInlineAttachments', () => {
  it('rewrites each description that still holds a file inline, without bumping updatedAt', async () => {
    const { store, storage } = fakeStore();
    store.getTaskIdsWithInlineAttachments.mockResolvedValue([4]);
    store.getTaskById.mockResolvedValue({
      id: 4,
      description: `<p>${chip('data:image/png;base64,AAAA')}</p>`,
    } as Task);
    store.createAttachment.mockResolvedValue(meta({ id: 9, taskId: 4 }));

    expect(await extractInlineAttachments(storage)).toBe(1);
    expect(store.setTaskDescription).toHaveBeenCalledWith(
      4,
      `<p>${chip('/api/attachments/9')}</p>`,
    );
    expect(store.bindAttachments).toHaveBeenCalledWith(4, [9]);
  });

  it('leaves a description that needs no change unwritten', async () => {
    const { store, storage } = fakeStore();
    store.getTaskIdsWithInlineAttachments.mockResolvedValue([4]);
    store.getTaskById.mockResolvedValue({ id: 4, description: chip('/api/attachments/9') } as Task);
    store.getAttachmentsMeta.mockResolvedValue([meta({ id: 9, taskId: 4 })]);

    expect(await extractInlineAttachments(storage)).toBe(0);
    expect(store.setTaskDescription).not.toHaveBeenCalled();
  });
});

describe('sweepOrphanAttachments', () => {
  it('deletes unbound rows older than the orphan ttl', async () => {
    const { store, storage } = fakeStore();
    store.deleteOrphanAttachments.mockResolvedValue(2);
    expect(await sweepOrphanAttachments(storage, NOW)).toBe(2);
    expect(store.deleteOrphanAttachments).toHaveBeenCalledWith(
      new Date(NOW.getTime() - ATTACHMENT_ORPHAN_TTL_MS),
    );
  });
});

describe('contentDispositionHeader', () => {
  it('names the file in both the ASCII and the UTF-8 form', () => {
    expect(contentDispositionHeader('inline', 'report.pdf')).toBe(
      `inline; filename="report.pdf"; filename*=UTF-8''report.pdf`,
    );
    expect(contentDispositionHeader('attachment', 'résumé "v2".pdf')).toBe(
      `attachment; filename="r_sum_ _v2_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22v2%22.pdf`,
    );
  });
});
