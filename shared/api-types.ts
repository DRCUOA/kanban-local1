import type { Task, Stage, SubStage, TaskHistoryEntry } from './schema';

/** Standard error response shape returned by all API endpoints on failure */
export interface ApiErrorResponse {
  error: string;
  status: number;
  details?: unknown;
}

/** Route params for endpoints containing :id */
export interface IdParams {
  id: string;
}

/** Route params for endpoints containing :stageId */
export interface StageIdParams {
  stageId: string;
}

// --- Task endpoint response types ---
export type TaskListResponse = Task[];
export type TaskResponse = Task;
export type TaskHistoryResponse = TaskHistoryEntry[];

// --- Stage endpoint response types ---
export type StageListResponse = Stage[];
export type StageResponse = Stage;

// --- SubStage endpoint response types ---
export type SubStageListResponse = SubStage[];
export type SubStageResponse = SubStage;
