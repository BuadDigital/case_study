import { describe, expect, it } from "vitest";
import {
  canManageOperationsTasks,
  operationsTasksUseAssigneeScope,
} from "../operations-task-roles";
import type { RoleId } from "@platform/types";
import { staffAccessOf } from "@platform/app-shared/app-data/case-specialist-sub-roles";

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
      "real-estate-appraiser",
    ] as RoleId[]) {
      expect(canManageOperationsTasks(staffAccessOf(role))).toBe(true);
      expect(operationsTasksUseAssigneeScope(staffAccessOf(role))).toBe(false);
    }
  });

  it("executors get an independent assignee-scoped queue", () => {
    for (const role of [
      "field-inspector",
      "government-reviewer",
      "engineering-office",
      "financial-officer",
    ] as RoleId[]) {
      expect(canManageOperationsTasks(staffAccessOf(role))).toBe(false);
      expect(operationsTasksUseAssigneeScope(staffAccessOf(role))).toBe(true);
    }
  });

  it("covers every known prototype role", () => {
    for (const role of ALL_ROLES) {
      expect(operationsTasksUseAssigneeScope(staffAccessOf(role))).toBe(
        !canManageOperationsTasks(staffAccessOf(role)),
      );
    }
  });
});
