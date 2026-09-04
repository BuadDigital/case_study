import { describe, expect, it } from "vitest";
import {
  buildQueueServerQuery,
  queueServerSort,
  resolveQueueServerAssigneeRole,
  QUEUE_DEFAULT_STATUSES,
  type ActiveTransactionQueueConfig,
} from "../active-transaction-queue-state";

function config(
  over: Partial<ActiveTransactionQueueConfig> = {},
): ActiveTransactionQueueConfig {
  return {
    pageTitle: "queue",
    emptyLine: "",
    emptyHint: "",
    panelId: "panel",
    getBasePath: () => "/",
    getTaskPath: (id) => `/${id}`,
    filterListed: (mine) => mine,
    ...over,
  };
}

describe("queueServerSort", () => {
  it("maps every queue sort mode onto an endpoint sort key", () => {
    expect(queueServerSort("oldest-first")).toEqual({
      sort: "poReceived",
      dir: "asc",
    });
    expect(queueServerSort("newest-first")).toEqual({
      sort: "poCreated",
      dir: "desc",
    });
    expect(queueServerSort("distributed-newest-first")).toEqual({
      sort: "updated",
      dir: "desc",
    });
    expect(queueServerSort(undefined)).toEqual({ sort: "updated", dir: "desc" });
  });
});

describe("resolveQueueServerAssigneeRole", () => {
  it("does not narrow for a viewer who sees every row of the page", () => {
    expect(
      resolveQueueServerAssigneeRole({
        role: "section-supervisor",
        pageId: "active-primary-data",
      }),
    ).toBeUndefined();
  });

  it("narrows a section supervisor outside the case-study queue pages", () => {
    expect(
      resolveQueueServerAssigneeRole({
        role: "section-supervisor",
        pageId: "property-inspection",
        partyAssignee: true,
        assigneeRole: "field-inspector",
      }),
    ).toBe("section-supervisor");
  });

  it("does not narrow a super admin on a page — they see every row", () => {
    expect(
      resolveQueueServerAssigneeRole({
        role: "cdo",
        pageId: "property-inspection",
        partyAssignee: true,
        assigneeRole: "field-inspector",
      }),
    ).toBeUndefined();
  });

  it("uses the queue's role for a super admin on a party queue with no page id", () => {
    expect(
      resolveQueueServerAssigneeRole({
        role: "cdo",
        partyAssignee: true,
        assigneeRole: "field-inspector",
      }),
    ).toBe("field-inspector");
    expect(
      resolveQueueServerAssigneeRole({ role: "cdo", partyAssignee: true }),
    ).toBeUndefined();
  });

  it("narrows a plain role queue to that role", () => {
    expect(
      resolveQueueServerAssigneeRole({ role: "field-inspector" }),
    ).toBe("field-inspector");
  });
});

describe("buildQueueServerQuery", () => {
  it("sends nothing when the screen still reads sibling rows", () => {
    expect(
      buildQueueServerQuery({
        config: config({ serverQuery: { kind: ["case-study-property"] } }),
        role: "field-inspector",
        showCompleted: false,
        narrow: false,
      }),
    ).toEqual({});
  });

  it("sends the screen's kind/phase plus the default listed statuses", () => {
    expect(
      buildQueueServerQuery({
        config: config({
          pageId: "active-primary-data",
          serverQuery: { kind: ["case-study-property"], phase: ["enfath"] },
        }),
        role: "case-specialist",
        showCompleted: false,
        narrow: true,
      }),
    ).toEqual({
      kind: ["case-study-property"],
      phase: ["enfath"],
      status: QUEUE_DEFAULT_STATUSES,
      assigneeRole: "case-specialist",
      sort: "updated",
      dir: "desc",
    });
  });

  it("omits the status filter when the screen lists every status", () => {
    const query = buildQueueServerQuery({
      config: config({ includeAllStatuses: true }),
      role: "case-specialist",
      showCompleted: false,
      narrow: true,
    });
    expect(query.status).toBeUndefined();
  });

  it("omits the status filter once a toggle queue shows completed rows", () => {
    const base = config({
      tableLayout: "engineering-survey",
      serverQuery: { kind: ["engineering-survey"] },
    });
    expect(
      buildQueueServerQuery({
        config: base,
        role: "engineering-office",
        showCompleted: false,
        narrow: true,
      }).status,
    ).toEqual(QUEUE_DEFAULT_STATUSES);
    expect(
      buildQueueServerQuery({
        config: base,
        role: "engineering-office",
        showCompleted: true,
        narrow: true,
      }).status,
    ).toBeUndefined();
  });

  it("lets the screen pin an explicit status set", () => {
    expect(
      buildQueueServerQuery({
        config: config({
          includeAllStatuses: true,
          serverQuery: { status: ["completed"] },
        }),
        role: "case-specialist",
        showCompleted: false,
        narrow: true,
      }).status,
    ).toEqual(["completed"]);
  });

  it("never sends `q` — the queue searches PO-record columns the server has no access to", () => {
    const query = buildQueueServerQuery({
      config: config(),
      role: "case-specialist",
      showCompleted: false,
      narrow: true,
    });
    expect(query).not.toHaveProperty("q");
  });
});
