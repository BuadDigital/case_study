using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class WorkOrderListStatusTests
{
    private static WorkOrder Order(int expected, int registered) => new()
    {
        PoNumber = "PO-1",
        ExpectedPropertyCount = expected,
        Properties = Enumerable.Range(0, registered)
            .Select(_ => new WorkOrderProperty { Id = Guid.NewGuid() })
            .ToList(),
    };

    [Fact]
    public void Resolve_all_studied_without_invoice_is_completed()
    {
        var status = WorkOrderListStatus.Resolve(Order(1, 1), studiedCount: 1);
        Assert.Equal(WorkOrderListStatus.Completed, status);
    }

    [Fact]
    public void Resolve_all_studied_with_invoice_is_fully_billed()
    {
        var status = WorkOrderListStatus.Resolve(
            Order(1, 1),
            studiedCount: 1,
            hasEnfazInvoice: true);
        Assert.Equal(WorkOrderListStatus.FullyBilled, status);
    }

    [Fact]
    public void Resolve_partial_study_is_under_study_not_billed()
    {
        var status = WorkOrderListStatus.Resolve(Order(2, 2), studiedCount: 1);
        Assert.Equal(WorkOrderListStatus.UnderStudy, status);
    }

    [Fact]
    public void Resolve_registered_without_study_is_under_study()
    {
        var status = WorkOrderListStatus.Resolve(Order(1, 1), studiedCount: 0);
        Assert.Equal(WorkOrderListStatus.UnderStudy, status);
    }

    [Fact]
    public void Resolve_invoice_before_all_studied_is_partially_billed()
    {
        var status = WorkOrderListStatus.Resolve(
            Order(2, 2),
            studiedCount: 1,
            hasEnfazInvoice: true);
        Assert.Equal(WorkOrderListStatus.PartiallyBilled, status);
    }
}
