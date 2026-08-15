import type { Task, Stage } from '@shared/schema';
import { apiGet } from '@/lib/api';
import { api } from '@shared/routes';
import { buildExportBundle, type TaskExportBundle } from '@shared/export';
import { logger } from '@shared/logger';

export interface FetchBoardBundleOptions {
  /** Tasks the board has loaded, used only for the in-memory fallback. */
  tasks: Task[] | undefined;
  stages: Stage[];
}

export interface BoardBundleResult {
  bundle: TaskExportBundle;
  /** True when the server was unavailable and the bundle was built in-memory. */
  degraded: boolean;
}

/**
 * The board-share scope: the full export bundle. Server-side export is
 * authoritative (it includes stages and sub-stages, not just the tasks this
 * board happens to have loaded); when it is unreachable the same envelope is
 * built from what the board already has. Throws only when both paths fail.
 */
export async function fetchBoardBundle({
  tasks,
  stages,
}: FetchBoardBundleOptions): Promise<BoardBundleResult> {
  try {
    return { bundle: await apiGet<TaskExportBundle>(api.export.get.path), degraded: false };
  } catch (error: unknown) {
    logger.error('Export API failed, falling back to in-memory export:', error);
    if (!tasks) throw error;
    return {
      bundle: buildExportBundle({
        tasks,
        stages,
        subStages: [],
        includeArchived: false,
        exportedAt: new Date().toISOString(),
      }),
      degraded: true,
    };
  }
}
