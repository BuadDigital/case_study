/**
 * Workflow-task facade — kept as a thin barrel because ~80 modules (and the
 * `@case-study/mfe` public surface in `src/index.ts`) import from this path.
 * The implementation lives in three modules:
 *  - `tasks-model`    task types, DTO mapping, distribution rules and labels
 *  - `tasks-reads`    task list loaders and the role/party queue selectors
 *  - `tasks-commands` slot sync, phase advances, distribution and status writes
 */
export type {
  WorkflowAssignmentType,
  CaseStudyTaskPhase,
  TaskDistributionDraft,
  WorkflowTask,
  WorkflowTaskKind,
  WorkflowTaskStatus,
} from "./tasks-model";
export {
  TASKS_CHANGED_EVENT,
  TASKS_STORAGE_KEY,
  notifyTasksChanged,
} from "./tasks-model";
export {
  buildAssigneeNames,
  defaultDistribution,
  distributionToDto,
  distributionValidationError,
  dtoToTask,
  engineeringOfficeAvailable,
  engineeringOfficeUnavailableReason,
  migrateDistribution,
  partyAssigneeIdFromDistribution,
  taskDisplayPropertyLabel,
  taskKindLabel,
  taskPhaseLabel,
  taskStatusLabel,
  type AdvanceTaskResult,
  type RedistributePartiesResult,
  type ReopenCompletedTaskResult,
  type RevertTaskPhaseResult,
  type SyncTaskSlotsResult,
  type SyncTasksResult,
} from "./tasks-model";

export {
  caseStudyTaskForProperty,
  compareWorkflowTasks,
  loadWorkflowTasks,
  loadWorkflowTasksForQuery,
  poCaseTasks,
  tasksForPartyAssignee,
  tasksForRole,
} from "./tasks-reads";

export {
  advanceTaskAfterBourse,
  advanceTaskAfterBourseForProperty,
  advanceTaskAfterEnfath,
  completeChildTask,
  confirmTaskDistribution,
  deletePrimaryDataTransaction,
  deleteTasksForPo,
  deleteTasksForProperty,
  linkNewPropertyToTaskSlot,
  patchTaskDistribution,
  redistributeTaskParties,
  reopenCompletedTransaction,
  resolveTaskObstruction,
  revertTaskToPhase,
  suspendWorkflowTasksForProperty,
  syncTaskSlotsForPo,
  syncTasksFromPoRecords,
} from "./tasks-commands";
