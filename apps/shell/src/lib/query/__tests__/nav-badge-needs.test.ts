import { describe, expect, it } from "vitest";
import type { PageId } from "@platform/types";
import { navBadgeNeeds } from "../nav-badge-needs";

const pages = (...ids: string[]) => ids as PageId[];

// 2026-11-19: the sidebar downloaded every task, work order, bourse item, failure and staff member
// on each page for counts that «أعمالي» had taken out of the sidebar — nobody saw them.
describe("navBadgeNeeds", () => {
  it("counts nothing and loads nothing for a case specialist, whose queues «أعمالي» replaced", () => {
    const needs = navBadgeNeeds(
      pages("my-work", "po", "all-transactions", "active-primary-data", "bourse-inquiry", "active-case-study"),
      "case-specialist",
    );
    expect([...needs.shown]).toEqual([]);
    expect(needs).toMatchObject({ tasks: false, poRecords: false, pendingBourse: false, staff: false, fees: false });
  });

  it("loads only the fees summary for the section supervisor, whose one counted row is «فوترة الأتعاب»", () => {
    const needs = navBadgeNeeds(
      pages("my-work", "active-primary-data", "bourse-inquiry", "active-case-study", "party-fees"),
      "section-supervisor",
    );
    expect([...needs.shown]).toEqual(["party-fees"]);
    expect(needs).toMatchObject({ tasks: false, poRecords: false, pendingBourse: false, staff: false, fees: true });
  });

  it("loads the tasks, work orders and staff for the engineering office's survey queue, and its fees", () => {
    const needs = navBadgeNeeds(pages("po", "active-survey", "party-fees", "failures"), "engineering-office");
    expect(needs.shown.has("active-survey")).toBe(true);
    expect(needs).toMatchObject({ tasks: true, poRecords: true, pendingBourse: false, staff: true, fees: true });
  });

  it("loads the bourse list only where «استعلام البورصة» is counted", () => {
    const needs = navBadgeNeeds(pages("bourse-inquiry"), "section-supervisor");
    expect(needs).toMatchObject({ tasks: false, poRecords: false, pendingBourse: true, staff: false });
  });

  it("loads the tasks and work orders for a stage queue still in the sidebar", () => {
    const needs = navBadgeNeeds(pages("active-primary-data", "system-upload"), "section-supervisor");
    expect(needs).toMatchObject({ tasks: true, poRecords: true, pendingBourse: false, staff: false });
  });
});
