import { describe, expect, it } from "vitest";
import {
  isUsableAssigneeDisplayName,
  resolveAssigneeDisplayName,
  resolvePartyName,
} from "../party-fee-meta";
import type { StaffUser } from "../../app-data/constants";

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
  it("rejects corruption, role stubs, and technical ids", () => {
    expect(isUsableAssigneeDisplayName("???? ????")).toBe(false);
    expect(isUsableAssigneeDisplayName("معاين ميداني")).toBe(false);
    expect(isUsableAssigneeDisplayName("fi-abdullah-abdulmane")).toBe(false);
    expect(isUsableAssigneeDisplayName("عبدالله عبدالمانع")).toBe(true);
  });

  it("resolves staff when stored name is bad or is the assignee id", () => {
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
    expect(
      resolveAssigneeDisplayName({
        assigneeName: "fi-abdullah-abdulmane",
        assigneeId: "fi-abdullah-abdulmane",
        staffUsers: [],
      }),
    ).toBe("عبدالله عبدالمانع");
  });

  it("resolvePartyName uses staff then seed Arabic fallback", () => {
    expect(resolvePartyName("fi-abdullah-abdulmane", staff)).toBe(
      "عبدالله عبدالمانع",
    );
    expect(resolvePartyName("fi-abdullah-abdulmane", [])).toBe(
      "عبدالله عبدالمانع",
    );
  });
});
