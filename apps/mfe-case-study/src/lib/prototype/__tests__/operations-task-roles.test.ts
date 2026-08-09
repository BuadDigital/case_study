import { describe, expect, it } from "vitest";
import {
  canManageOperationsTasks,
  operationsTasksUseAssigneeScope,
} from "../operations-task-roles";
import type { RoleId } from "@platform/types";

const ALL_ROLES: RoleId[] = [
  "cdo",
  "general-manager",
  "section-supervisor",
  "case-specialist",
  "real-estate-appraiser",
  "field-inspector",
  "government-reviewer",
  "engineering-office",
  "financial-officer",
];

describe("operationsTasksUseAssigneeScope", () => {
  it("managers share the full team inbox", () => {
    for (const role of [
      "cdo",
      "general-manager",
      "section-supervisor",
      "case-specialist",
    ] as RoleId[]) {
      expect(canManageOperationsTasks(role)).toBe(true);
      expect(operationsTasksUseAssigneeScope(role)).toBe(false);
    }
  });

  it("executors get an independent assignee-scoped queue", () => {
    for (const role of [
      "real-estate-appraiser",
      "field-inspector",
      "government-reviewer",
      "engineering-office",
      "financial-officer",
    ] as RoleId[]) {
      expect(canManageOperationsTasks(role)).toBe(false);
      expect(operationsTasksUseAssigneeScope(role)).toBe(true);
    }
  });

  it("covers every known prototype role", () => {
    for (const role of ALL_ROLES) {
      expect(operationsTasksUseAssigneeScope(role)).toBe(
        !canManageOperationsTasks(role),
      );
    }
  });
});
