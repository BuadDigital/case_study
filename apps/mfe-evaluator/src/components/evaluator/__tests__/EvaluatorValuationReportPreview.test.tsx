import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EvaluatorValuationReportPreviewProps } from "@platform/app-shared/party-appraisal/evaluator-runtime-bridge";

const reads = vi.hoisted(() => ({ fetchEvaluatorSubmission: vi.fn() }));

vi.mock("../../../lib/evaluator/evaluator-submission-reads", () => reads);
vi.mock("@settings/mfe/query/settings-queries", () => ({
  useStaffUsersQuery: () => ({ data: undefined }),
}));
vi.mock("../EvaluatorValuationReportOutputTab", () => ({
  EvaluatorValuationReportOutputTab: ({ draft }: { draft: { taskId: string; reportNo: string } }) => (
    <div data-testid="report">{`${draft.taskId}|${draft.reportNo}`}</div>
  ),
}));

import { EvaluatorValuationReportPreview } from "../EvaluatorValuationReportPreview";
import {
  evaluatorSubmissionQueryOptions,
  useEvaluatorSubmissionQuery,
} from "../../../query/evaluator-submission-query";

const TASK = "task-1";
const props = {
  appraisalTask: { id: TASK, propertyId: "prop-1", poNumber: "PO-1" },
  allTasks: [],
  property: { id: "prop-1" },
} as unknown as EvaluatorValuationReportPreviewProps;

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Stands in for ReportDraftPanel: reads the same submission through the shared hook. */
function PanelReader() {
  const q = useEvaluatorSubmissionQuery(TASK);
  return <span data-testid="panel">{q.isPending ? "pending" : String(q.data)}</span>;
}

beforeEach(() => {
  reads.fetchEvaluatorSubmission.mockReset();
});

describe("EvaluatorValuationReportPreview", () => {
  it("shows the empty report — not an endless loader — when no submission is saved yet", async () => {
    reads.fetchEvaluatorSubmission.mockResolvedValue(null);
    render(
      <QueryClientProvider client={newClient()}>
        <PanelReader />
        <EvaluatorValuationReportPreview {...props} />
      </QueryClientProvider>,
    );
    expect((await screen.findByTestId("report")).textContent).toBe(`${TASK}|`);
    expect(screen.getByTestId("panel").textContent).toBe("null");
    expect(reads.fetchEvaluatorSubmission).toHaveBeenCalledTimes(1);
  });

  it("renders from a null the report panel already cached under the shared key", async () => {
    const client = newClient();
    client.setQueryData(evaluatorSubmissionQueryOptions(TASK).queryKey, null);
    render(
      <QueryClientProvider client={client}>
        <EvaluatorValuationReportPreview {...props} />
      </QueryClientProvider>,
    );
    expect((await screen.findByTestId("report")).textContent).toBe(`${TASK}|`);
    expect(reads.fetchEvaluatorSubmission).not.toHaveBeenCalled();
  });

  it("renders the appraiser's saved submission when there is one", async () => {
    reads.fetchEvaluatorSubmission.mockResolvedValue({ taskId: TASK, reportNo: "R-9" });
    render(
      <QueryClientProvider client={newClient()}>
        <EvaluatorValuationReportPreview {...props} />
      </QueryClientProvider>,
    );
    expect((await screen.findByTestId("report")).textContent).toBe(`${TASK}|R-9`);
  });
});
