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
}
