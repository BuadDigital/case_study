using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class WorkflowStatusesTests
{
    [Fact]
    public void WorkflowTaskStatus_IsTerminal_matches_completed_and_cancelled()
    {
        Assert.True(WorkflowTaskStatus.IsTerminal(WorkflowTaskStatus.Completed));
        Assert.True(WorkflowTaskStatus.IsTerminal(WorkflowTaskStatus.Cancelled));
        Assert.False(WorkflowTaskStatus.IsTerminal(WorkflowTaskStatus.Open));
        Assert.False(WorkflowTaskStatus.IsTerminal(WorkflowTaskStatus.Blocked));
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
