using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class WorkflowStatusesTests
{
    [Fact]
    public void WorkflowTaskStatus_IsTerminal_matches_completed_and_cancelled()
    {
        Assert.True(WorkflowTaskStatus.Completed.IsTerminal());
        Assert.True(WorkflowTaskStatus.Cancelled.IsTerminal());
        Assert.False(WorkflowTaskStatus.Open.IsTerminal());
        Assert.False(WorkflowTaskStatus.Blocked.IsTerminal());
    }

    [Fact]
    public void PropertyFailureStatus_IsActive_excludes_terminal_states()
    {
        Assert.True(PropertyFailureStatus.IsActive(PropertyFailureStatus.Internal));
        Assert.True(PropertyFailureStatus.IsActive(PropertyFailureStatus.Review));
        Assert.False(PropertyFailureStatus.IsActive(PropertyFailureStatus.Resolved));
        Assert.False(PropertyFailureStatus.IsActive(PropertyFailureStatus.Suspended));
    }

    [Fact]
    public void Property_key_wire_constants_match_persisted_values()
    {
        Assert.Equal("progress", PropertyKeyWorkflowStatuses.Progress);
        Assert.Equal("done", PropertyKeyWorkflowStatuses.Done);
        Assert.True(PropertyKeyWorkflowStatuses.IsDone("DONE"));
        Assert.False(PropertyKeyWorkflowStatuses.IsDone(PropertyKeyWorkflowStatuses.Progress));

        Assert.True(PropertyKeysStatuses.IsLegacyQueueStatus(PropertyKeysStatuses.Pending));
        Assert.True(PropertyKeysStatuses.IsLegacyQueueStatus(PropertyKeysStatuses.Received));
        Assert.False(PropertyKeysStatuses.IsLegacyQueueStatus(PropertyKeysStatuses.NotRequired));

        Assert.Equal("yes", PropertyKeyHandedValues.Yes);
        Assert.Equal("court_access", PropertyKeyGateSources.CourtAccess);
        Assert.Equal("envelope", PropertyKeyGateSources.Envelope);
    }

    [Fact]
    public void Property_list_row_and_timeline_wire_constants_match_persisted_values()
    {
        Assert.Equal("new", PropertyListRowStatuses.New);
        Assert.Equal("fail", PropertyListRowStatuses.Fail);
        Assert.Equal("incomplete", PropertyListRowStatuses.Incomplete);

        Assert.Equal("active", PropertyTimelineTones.Active);
        Assert.Equal(PropertyTimelineTones.Done, PropertyTimelineTones.Normalize("DONE"));
        Assert.Equal(PropertyTimelineTones.Warn, PropertyTimelineTones.Normalize("warn"));

        Assert.Equal("done", FinancialRevenueRowStatuses.Done);
        Assert.Equal("progress", FinancialRevenueRowStatuses.Progress);
    }
}
