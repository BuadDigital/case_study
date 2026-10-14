using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// PO list status: delivery is the Enfaz handover. «completed» needs every live property closed
/// (handed over or fully cancelled); «ready_for_enfaz» every property deliverable but not yet
/// delivered; the billing labels only relabel those two once Finance issued an invoice.
/// </summary>
public class WorkOrderListStatusTests
{
    private static string Resolve(
        int expected,
        int registered,
        int readyCount,
        int closedCount,
        bool hasEnfazInvoice = false) =>
        WorkOrderListStatus.Resolve(
            lifecycleStatus: null,
            expectedPropertyCount: expected,
            registeredCount: registered,
            readyCount: readyCount,
            closedCount: closedCount,
            hasEnfazInvoice: hasEnfazInvoice);

    private static string ResolveStudy(int expected, int registered, int readyCount, int closedCount) =>
        WorkOrderListStatus.ResolveStudy(
            lifecycleStatus: null,
            expectedPropertyCount: expected,
            registeredCount: registered,
            readyCount: readyCount,
            closedCount: closedCount);

    [Fact]
    public void Nothing_registered_is_new()
    {
        Assert.Equal(WorkOrderListStatus.New, Resolve(2, 0, readyCount: 0, closedCount: 0));
    }

    [Fact]
    public void Registered_without_delivery_is_under_study()
    {
        Assert.Equal(WorkOrderListStatus.UnderStudy, Resolve(1, 1, readyCount: 0, closedCount: 0));
        Assert.Equal(WorkOrderListStatus.UnderStudy, Resolve(2, 2, readyCount: 1, closedCount: 0));
    }

    /// <summary>The report is issued and the parties are done, but nothing left the office yet.</summary>
    [Fact]
    public void Every_property_ready_but_none_handed_over_is_ready_for_enfaz()
    {
        Assert.Equal(WorkOrderListStatus.ReadyForEnfaz, Resolve(2, 2, readyCount: 2, closedCount: 0));
        Assert.Equal(WorkOrderListStatus.ReadyForEnfaz, Resolve(2, 2, readyCount: 2, closedCount: 1));
    }

    [Fact]
    public void Fewer_registered_than_expected_is_never_ready_or_completed()
    {
        Assert.Equal(WorkOrderListStatus.UnderStudy, Resolve(3, 2, readyCount: 2, closedCount: 2));
    }

    [Fact]
    public void Every_property_handed_over_is_completed()
    {
        Assert.Equal(WorkOrderListStatus.Completed, Resolve(1, 1, readyCount: 1, closedCount: 1));
        Assert.Equal(WorkOrderListStatus.Completed, ResolveStudy(2, 2, readyCount: 2, closedCount: 2));
    }

    [Fact]
    public void An_invoice_relabels_completed_as_fully_billed()
    {
        Assert.Equal(
            WorkOrderListStatus.FullyBilled,
            Resolve(1, 1, readyCount: 1, closedCount: 1, hasEnfazInvoice: true));
    }

    [Fact]
    public void An_invoice_before_delivery_is_partially_billed_while_the_study_status_stays()
    {
        Assert.Equal(
            WorkOrderListStatus.PartiallyBilled,
            Resolve(2, 2, readyCount: 2, closedCount: 1, hasEnfazInvoice: true));
        Assert.Equal(
            WorkOrderListStatus.PartiallyBilled,
            Resolve(2, 2, readyCount: 1, closedCount: 0, hasEnfazInvoice: true));
        Assert.Equal(WorkOrderListStatus.ReadyForEnfaz, ResolveStudy(2, 2, readyCount: 2, closedCount: 1));
    }

    [Fact]
    public void Lifecycle_overrides_win_over_everything()
    {
        Assert.Equal(
            WorkOrderListStatus.Cancelled,
            WorkOrderListStatus.Resolve(
                WorkOrderLifecycleStatus.Cancelled, 1, 1, readyCount: 1, closedCount: 1, hasEnfazInvoice: true));
        Assert.Equal(
            WorkOrderListStatus.Stopped,
            WorkOrderListStatus.ResolveStudy(WorkOrderLifecycleStatus.Stopped, 1, 1, readyCount: 1, closedCount: 1));
    }
}
