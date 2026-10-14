"use client";

import { useMemo } from "react";
import { useOperationsTasksQuery } from "../query/operations-tasks-queries";
import {
  courtVisitTasksForProperty,
  filterOperationsTasksForProperty,
  primaryCourtVisitTask,
  type PropertyOpsScopeInput,
} from "../lib/app-data/operations-task-property-scope";
import type { OperationsTask } from "../lib/app-data/operations-tasks-model";

export function usePropertyOperationsTasks(
  scope: PropertyOpsScopeInput,
  options?: { live?: boolean },
) {
  const query = useOperationsTasksQuery({ live: options?.live ?? true });
  const tasks = query.data ?? [];

  // Callers build `scope` inline, so it is a new object on every render; the three
  // fields below are what the filters actually read.
  /* eslint-disable react-hooks/exhaustive-deps */
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
  /* eslint-enable react-hooks/exhaustive-deps */

  return {
    ...query,
    propertyTasks: propertyTasks as OperationsTask[],
    courtVisits: courtVisits as OperationsTask[],
    primaryCourtVisit: primaryCourtVisit as OperationsTask | null,
  };
}
