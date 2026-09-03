using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class WorkOrderListStatusTests
{
    private static string Resolve(
        int expected,
        int registered,
        int studiedCount,
        bool hasEnfazInvoice = false) =>
        WorkOrderListStatus.Resolve(
            lifecycleStatus: null,
            expectedPropertyCount: expected,
            registeredCount: registered,
            studiedCount: studiedCount,
            hasEnfazInvoice: hasEnfazInvoice);

    [Fact]
    public void Resolve_all_studied_without_invoice_is_completed()
    {
        Assert.Equal(WorkOrderListStatus.Completed, Resolve(1, 1, studiedCount: 1));
    }

    [Fact]
    public void Resolve_all_studied_with_invoice_is_fully_billed()
    {
        Assert.Equal(
            WorkOrderListStatus.FullyBilled,
            Resolve(1, 1, studiedCount: 1, hasEnfazInvoice: true));
    }

    [Fact]
    public void Resolve_partial_study_is_under_study_not_billed()
    {
        Assert.Equal(WorkOrderListStatus.UnderStudy, Resolve(2, 2, studiedCount: 1));
    }

    [Fact]
    public void Resolve_registered_without_study_is_under_study()
    {
        Assert.Equal(WorkOrderListStatus.UnderStudy, Resolve(1, 1, studiedCount: 0));
    }

    [Fact]
    public void Resolve_invoice_before_all_studied_is_partially_billed()
    {
        Assert.Equal(
            WorkOrderListStatus.PartiallyBilled,
            Resolve(2, 2, studiedCount: 1, hasEnfazInvoice: true));
    }

    [Fact]
    public void Resolve_cancelled_lifecycle_wins_over_everything()
    {
        var status = WorkOrderListStatus.Resolve(
            WorkOrderLifecycleStatus.Cancelled, 1, 1, studiedCount: 1, hasEnfazInvoice: true);
        Assert.Equal(WorkOrderListStatus.Cancelled, status);
    }
}
