import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PartyStatusRows, type PropertyPartyStatusRow } from "../PropertyPartiesStatus";

const rows: PropertyPartyStatusRow[] = [
  { key: "specialist", label: "سارة الأخصائية", role: "أخصائي دراسة الحالة", badge: "قيد التنفيذ", badgeClass: "pd-badge-amber" },
  { key: "inspection", label: "أحمد سعيد", role: "المعاين", badge: "مكتمل", badgeClass: "pd-badge-teal" },
  { key: "survey", label: "لم يُعيَّن", role: "المكتب الهندسي", badge: "معطّل", badgeClass: "pd-badge-gray" },
  { key: "appraisal", label: "عبدالله الكثيري", role: "المقيّم", badge: "بانتظار المسودة", badgeClass: "pd-badge-amber" },
];

describe("PartyStatusRows", () => {
  it("in the timeline column stacks each assignee's name over his role", () => {
    render(<PartyStatusRows rows={rows} />);
    expect(screen.getByText("أحمد سعيد")).toBeTruthy();
    expect(screen.getByText("المعاين")).toBeTruthy();
    expect(screen.getByText("مكتمل")).toBeTruthy();
  });

  it("under the sections rail shows the role and the status only — no names", () => {
    render(<PartyStatusRows rows={rows} showNames={false} />);
    for (const row of rows) {
      const line = screen.getByTestId(`party-status-${row.key}`);
      expect(line.textContent).toBe(`${row.role}${row.badge}`);
    }
    expect(screen.queryByText("أحمد سعيد")).toBeNull();
    expect(screen.queryByText("لم يُعيَّن")).toBeNull();
  });
});
