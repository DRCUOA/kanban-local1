// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveTextFile, type SaveTextFileOptions } from './save-file';

const options: SaveTextFileOptions = {
  filename: 'taskflow-task-1.txt',
  content: 'hello',
  mimeType: 'text/plain',
};

type PickerWindow = Window & { showSaveFilePicker?: unknown };

function stubAnchorDownload() {
  const clicks: string[] = [];
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this.download);
  });
  return { clicks, clickSpy };
}

const revokeObjectURL = vi.fn();

describe('saveTextFile', () => {
  beforeEach(() => {
    revokeObjectURL.mockClear();
    // jsdom has no object URLs; the fallback path needs both stubs.
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:stub');
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    delete (window as PickerWindow).showSaveFilePicker;
    vi.restoreAllMocks();
  });

  it('writes through the native picker when it is available', async () => {
    const write = vi.fn();
    const close = vi.fn();
    const picker = vi.fn().mockResolvedValue({
      createWritable: () => Promise.resolve({ write, close }),
    });
    (window as PickerWindow).showSaveFilePicker = picker;

    const result = await saveTextFile(options);

    expect(result).toBe('saved');
    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'taskflow-task-1.txt' }),
    );
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('advertises the matching extension for JSON', async () => {
    const picker = vi.fn().mockResolvedValue({
      createWritable: () => Promise.resolve({ write: vi.fn(), close: vi.fn() }),
    });
    (window as PickerWindow).showSaveFilePicker = picker;

    await saveTextFile({ ...options, filename: 'x.json', mimeType: 'application/json' });

    const args = picker.mock.calls[0]?.[0] as { types: { accept: Record<string, string[]> }[] };
    expect(args.types[0]?.accept).toEqual({ 'application/json': ['.json'] });
  });

  it('reports a dismissed picker as cancelled without downloading', async () => {
    (window as PickerWindow).showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException('user dismissed', 'AbortError'));
    const { clicks } = stubAnchorDownload();

    const result = await saveTextFile(options);

    expect(result).toBe('cancelled');
    expect(clicks).toHaveLength(0);
  });

  it('falls back to an anchor download when the picker fails', async () => {
    (window as PickerWindow).showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException('nope', 'SecurityError'));
    const { clicks } = stubAnchorDownload();

    const result = await saveTextFile(options);

    expect(result).toBe('downloaded');
    expect(clicks).toEqual(['taskflow-task-1.txt']);
  });

  it('uses the anchor download when no picker exists', async () => {
    const { clicks } = stubAnchorDownload();

    const result = await saveTextFile(options);

    expect(result).toBe('downloaded');
    expect(clicks).toEqual(['taskflow-task-1.txt']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub');
  });
});
