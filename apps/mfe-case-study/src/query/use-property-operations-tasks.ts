"use client";

import { useMemo } from "react";
import { useOperationsTasksQuery } from "../query/operations-tasks-queries";
import {
  courtVisitTasksForProperty,
  filterOperationsTasksForProperty,
  primaryCourtVisitTask,
  type PropertyOpsScopeInput,
} from "../lib/prototype/operations-task-property-scope";
import type { OperationsTask } from "../lib/prototype/operations-tasks-storage";

export function usePropertyOperationsTasks(
  scope: PropertyOpsScopeInput,
  options?: { live?: boolean },
) {
  const query = useOperationsTasksQuery({ live: options?.live ?? true });
  const tasks = query.data ?? [];

  const propertyTasks = useMemo(
    () => filterOperationsTasksForProperty(tasks, scope),
    [tasks, scope.poNumber, scope.deedNumber, scope.deedDisplay],
  );

  const courtVisits = useMemo(
    () => courtVisitTasksForProperty(tasks, scope),
    [tasks, scope.poNumber, scope.deedNumber, scope.deedDisplay],
  );

  const primaryCourtVisit = useMemo(
    () => primaryCourtVisitTask(tasks, scope),
    [tasks, scope.poNumber, scope.deedNumber, scope.deedDisplay],
  );

  return {
    ...query,
    propertyTasks: propertyTasks as OperationsTask[],
    courtVisits: courtVisits as OperationsTask[],
    primaryCourtVisit: primaryCourtVisit as OperationsTask | null,
  };
}
