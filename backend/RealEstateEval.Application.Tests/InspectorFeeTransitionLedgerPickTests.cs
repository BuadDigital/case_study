using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class InspectorFeeTransitionLedgerPickTests
{
    [Fact]
    public void Prefers_actor_draft_over_legacy_returned_on_same_task()
    {
        var taskId = Guid.NewGuid();
        var returnedLegacy = new InspectorFeeLedger
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = taskId,
            AssigneeId = "fi-abdullah-abdulmane",
            UserId = "fi-ahmed",
            BillingStatus = InspectorFeeBillingStatus.Returned,
            ReturnTo = InspectorFeeReturnTo.Supervisor,
            AgreedFeeSar = 400m,
            UpdatedAtUtc = DateTime.UtcNow.AddHours(-2),
            CreatedAtUtc = DateTime.UtcNow.AddHours(-2),
        };
        var draft = new InspectorFeeLedger
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = taskId,
            AssigneeId = "fi-abdullah-abdulmane",
            UserId = "fi-abdullah-abdulmane",
            BillingStatus = InspectorFeeBillingStatus.Draft,
            AgreedFeeSar = 400m,
            UpdatedAtUtc = DateTime.UtcNow,
            CreatedAtUtc = DateTime.UtcNow,
        };

        var picked = InspectorFeeService.PickLedgerForTransition(
            [returnedLegacy, draft],
            InspectorFeeActions.SubmitToSupervisor,
            "fi-abdullah-abdulmane");

        Assert.NotNull(picked);
        Assert.Equal(draft.Id, picked!.Id);
    }
}
