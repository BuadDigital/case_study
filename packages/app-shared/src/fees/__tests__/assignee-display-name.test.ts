import { describe, expect, it } from "vitest";
import {
  isUsableAssigneeDisplayName,
  resolveAssigneeDisplayName,
} from "../party-fee-meta";
import type { StaffUser } from "../../prototype/constants";

const staff: StaffUser[] = [
  {
    id: "u1",
    name: "عبدالله عبدالمانع",
    distributionAssigneeId: "fi-abdullah-abdulmane",
    role: "field-inspector",
    email: "abdullah.abdulmane@ejadah.dev",
    type: "internal",
  },
];

describe("assignee display name", () => {
  it("rejects corruption and role stubs", () => {
    expect(isUsableAssigneeDisplayName("???? ????")).toBe(false);
    expect(isUsableAssigneeDisplayName("معاين ميداني")).toBe(false);
    expect(isUsableAssigneeDisplayName("عبدالله عبدالمانع")).toBe(true);
  });

  it("resolves staff when stored name is bad", () => {
    expect(
      resolveAssigneeDisplayName({
        assigneeName: "???? ????",
        assigneeId: "fi-abdullah-abdulmane",
        staffUsers: staff,
      }),
    ).toBe("عبدالله عبدالمانع");
    expect(
      resolveAssigneeDisplayName({
        assigneeName: "معاين ميداني",
        assigneeId: "fi-abdullah-abdulmane",
        staffUsers: staff,
      }),
    ).toBe("عبدالله عبدالمانع");
  });
});
