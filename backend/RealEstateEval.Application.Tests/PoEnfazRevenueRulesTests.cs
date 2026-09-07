using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>Revenue line, save input and tracking row rules extracted out of PoEnfazBillingService.</summary>
public class PoEnfazRevenueRulesTests
{
    private static readonly DateTime Now = new(2026, 3, 2, 8, 0, 0, DateTimeKind.Utc);

    private static readonly (string Status, string Label) Done =
        (InspectorFeeWorkStatuses.Done, InspectorFeeBillingRules.WorkStatusLabel(InspectorFeeWorkStatuses.Done));

    private static CaseStudyPropertySnapshotDto Property(
        string request = "",
        string deed = "D-1",
        string district = "",
        Guid? id = null) => new()
        {
            Id = id ?? Guid.NewGuid(),
            PoNumber = "PO-1",
            RequestNumber = request,
            DeedNumber = deed,
            District = district,
            City = " الرياض ",
            Area = " 500 ",
        };

    private static WorkflowTask TaskFor(Guid propertyId, WorkflowTaskStatus status) =>
        WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-1",
            Now,
            status: status,
            propertyId: propertyId);

    private static PoEnfazRevenueLine Line(
        decimal caseStudy = 100m,
        decimal survey = 50m,
        decimal key = 0m,
        bool included = true,
        Guid? envelopeId = null) => new()
        {
            Id = Guid.NewGuid(),
            PoNumber = "PO-1",
            PropertyId = Guid.NewGuid(),
            CaseStudyFeeSar = caseStudy,
            SurveyFeeSar = survey,
            KeyFeeSar = key,
            IncludedInBilling = included,
            KeyEntitlementEnvelopeId = envelopeId,
        };

    // ---- labels ----

    [Fact]
    public void Line_label_prefers_the_request_number_and_appends_the_district()
    {
        Assert.Equal("R-9 — العليا", PoEnfazRevenueRules.PropertyLineLabel(
            Property(request: " R-9 ", deed: "D-1", district: " العليا ")));
        Assert.Equal("D-1", PoEnfazRevenueRules.PropertyLineLabel(Property(deed: " D-1 ")));
        Assert.Equal("D-1", PoEnfazRevenueRules.PropertyOrderKey(Property(request: " ")));
        Assert.Equal("R-9", PoEnfazRevenueRules.PropertyOrderKey(Property(request: "R-9")));
    }

    [Fact]
    public void A_property_without_a_computed_status_is_in_progress()
    {
        var known = Guid.NewGuid();
        var statuses = new Dictionary<Guid, (string Status, string Label)> { [known] = Done };

        Assert.Equal(Done, PoEnfazRevenueRules.WorkOrInProgress(statuses, known));
        Assert.Equal(
            InspectorFeeWorkStatuses.InProgress,
            PoEnfazRevenueRules.WorkOrInProgress(statuses, Guid.NewGuid()).Status);
    }

    // ---- ready summary ----

    [Fact]
    public void Ready_summary_counts_done_and_cancelled_properties()
    {
        var done = Property(id: Guid.NewGuid());
        var cancelled = Property(id: Guid.NewGuid());

        var summary = PoEnfazRevenueRules.ReadySummary(
            "PO-1",
            [done, cancelled],
            [
                TaskFor(done.Id, WorkflowTaskStatus.Completed),
                TaskFor(cancelled.Id, WorkflowTaskStatus.Cancelled),
            ]);

        Assert.NotNull(summary);
        Assert.Equal("PO-1", summary.PoNumber);
        Assert.Equal(1, summary.DoneCount);
        Assert.Equal(1, summary.CancelledCount);
    }

    [Fact]
    public void A_po_with_open_or_untasked_properties_is_not_ready()
    {
        var open = Property(id: Guid.NewGuid());
        Assert.Null(PoEnfazRevenueRules.ReadySummary(
            "PO-1", [open], [TaskFor(open.Id, WorkflowTaskStatus.Open)]));

        var untasked = Property(id: Guid.NewGuid());
        Assert.Null(PoEnfazRevenueRules.ReadySummary("PO-1", [untasked], []));
    }

    // ---- entitlements + revenue line ----

    [Fact]
    public void First_entitlement_per_property_wins()
    {
        var property = Guid.NewGuid();
        var first = new PropertyKeyEntitlement(property, Guid.NewGuid(), ["a"]);
        var second = new PropertyKeyEntitlement(property, Guid.NewGuid(), ["b"]);

        var map = PoEnfazRevenueRules.FirstEntitlementPerProperty([first, second]);

        Assert.Same(first, Assert.Single(map).Value);
    }

    [Fact]
    public void Revenue_line_without_a_row_is_unpriced_and_billed_unless_cancelled()
    {
        var property = Property(request: "R-1");
        var envelope = Guid.NewGuid();

        var dto = PoEnfazRevenueRules.ToRevenueLineDto(
            "PO-1", property, Done, null, new PropertyKeyEntitlement(property.Id, envelope, ["att-1"]));

        Assert.Equal("", dto.Id);
        Assert.Equal("R-1", dto.PropertyLabel);
        Assert.Equal(0m, dto.EnfazFeeSar);
        Assert.True(dto.IncludedInBilling);
        Assert.True(dto.HasKeyEntitlement);
        Assert.Equal(envelope.ToString(), dto.KeyEntitlementEnvelopeId);
        Assert.Equal("att-1", Assert.Single(dto.KeyAttachmentIds));

        var cancelledWork = (InspectorFeeWorkStatuses.Cancelled, "x");
        Assert.False(PoEnfazRevenueRules.ToRevenueLineDto("PO-1", property, cancelledWork, null, null).IncludedInBilling);
    }

    [Fact]
    public void Revenue_line_with_a_row_reports_its_amounts_and_stored_envelope()
    {
        var property = Property();
        var envelope = Guid.NewGuid();
        var row = Line(caseStudy: 100m, survey: 50m, key: 25m, included: false, envelopeId: envelope);

        var dto = PoEnfazRevenueRules.ToRevenueLineDto("PO-1", property, Done, row, null);

        Assert.Equal(row.Id.ToString(), dto.Id);
        Assert.Equal(175m, dto.EnfazFeeSar);
        Assert.Equal(25m, dto.KeyFeeSar);
        Assert.False(dto.IncludedInBilling);
        Assert.True(dto.HasKeyEntitlement);
        Assert.Equal(envelope.ToString(), dto.KeyEntitlementEnvelopeId);
        Assert.Empty(dto.KeyAttachmentIds);
    }

    // ---- save input ----

    [Fact]
    public void Save_input_must_name_a_property_of_the_po()
    {
        var valid = Guid.NewGuid();
        var set = new HashSet<Guid> { valid };

        Assert.True(PoEnfazRevenueRules.TryParseLineProperty(
            new PoEnfazRevenueLineInput { PropertyId = $" {valid} " }, set, out var parsed));
        Assert.Equal(valid, parsed);
        Assert.False(PoEnfazRevenueRules.TryParseLineProperty(
            new PoEnfazRevenueLineInput { PropertyId = Guid.NewGuid().ToString() }, set, out _));
        Assert.False(PoEnfazRevenueRules.TryParseLineProperty(
            new PoEnfazRevenueLineInput { PropertyId = "nope" }, set, out _));
    }

    [Fact]
    public void Save_input_clamps_amounts_and_keeps_the_envelope_while_a_key_fee_stands()
    {
        var envelope = Guid.NewGuid();
        var row = Line(key: 10m, envelopeId: envelope);

        PoEnfazRevenueRules.ApplyLineInput(
            row,
            new PoEnfazRevenueLineInput { CaseStudyFeeSar = -5m, SurveyFeeSar = 70m, KeyFeeSar = 20m, IncludedInBilling = false },
            Now);

        Assert.Equal(0m, row.CaseStudyFeeSar);
        Assert.Equal(70m, row.SurveyFeeSar);
        Assert.Equal(20m, row.KeyFeeSar);
        Assert.Equal(envelope, row.KeyEntitlementEnvelopeId);
        Assert.False(row.IncludedInBilling);
        Assert.Equal(Now, row.UpdatedAtUtc);
    }

    [Fact]
    public void Save_input_replaces_a_resent_envelope_and_drops_it_with_the_fee()
    {
        var resent = Guid.NewGuid();
        var row = Line(key: 10m, envelopeId: Guid.NewGuid());
        PoEnfazRevenueRules.ApplyLineInput(
            row,
            new PoEnfazRevenueLineInput { KeyFeeSar = 10m, KeyEntitlementEnvelopeId = resent.ToString() },
            Now);
        Assert.Equal(resent, row.KeyEntitlementEnvelopeId);

        PoEnfazRevenueRules.ApplyLineInput(row, new PoEnfazRevenueLineInput { KeyFeeSar = 0m }, Now);
        Assert.Null(row.KeyEntitlementEnvelopeId);
    }

    [Fact]
    public void Missing_envelopes_are_linked_from_the_property_entitlement()
    {
        var linked = Line(key: 10m);
        var alreadyLinked = Line(key: 10m, envelopeId: Guid.NewGuid());
        var noKeyFee = Line(key: 0m);
        var envelope = Guid.NewGuid();
        var entitlements = new Dictionary<Guid, PropertyKeyEntitlement>
        {
            [linked.PropertyId] = new(linked.PropertyId, envelope, []),
            [alreadyLinked.PropertyId] = new(alreadyLinked.PropertyId, Guid.NewGuid(), []),
            [noKeyFee.PropertyId] = new(noKeyFee.PropertyId, Guid.NewGuid(), []),
        };

        var before = alreadyLinked.KeyEntitlementEnvelopeId;
        PoEnfazRevenueRules.LinkMissingEnvelopes([linked, alreadyLinked, noKeyFee], entitlements);

        Assert.Equal(envelope, linked.KeyEntitlementEnvelopeId);
        Assert.Equal(before, alreadyLinked.KeyEntitlementEnvelopeId);
        Assert.Null(noKeyFee.KeyEntitlementEnvelopeId);
    }

    // ---- property revenue + tracking ----

    [Fact]
    public void Property_revenue_needs_a_billed_line_with_an_amount()
    {
        Assert.False(PoEnfazRevenueRules.PropertyRevenue(null).HasEnfazRevenue);
        Assert.False(PoEnfazRevenueRules.PropertyRevenue(Line(included: false)).HasEnfazRevenue);
        Assert.False(PoEnfazRevenueRules.PropertyRevenue(Line(caseStudy: 0m, survey: 0m)).HasEnfazRevenue);

        var revenue = PoEnfazRevenueRules.PropertyRevenue(Line(caseStudy: 100m, survey: 50m, key: 5m));
        Assert.True(revenue.HasEnfazRevenue);
        Assert.Equal(100m, revenue.CaseStudyFeeSar);
        Assert.Equal(50m, revenue.SurveyFeeSar);
        Assert.Equal(155m, revenue.EnfazFeeSar);
    }

    [Fact]
    public void Tracking_row_dates_completion_only_while_the_work_is_done()
    {
        var bourse = Now.AddDays(-3);
        var property = Property(request: "R-2", district: "حي");
        property.BourseCompletedAtUtc = bourse;
        var invoice = new PoEnfazInvoice { InvoiceNumber = "INV-1", Status = PoEnfazInvoiceStatus.Issued, CollectedAmountSar = 10m, IssuedAtUtc = Now };
        var flag = new PoEnfazFinanceFlag { Flag = PoEnfazFinanceFlagKind.Stopped, Note = "n" };

        var row = PoEnfazRevenueRules.ToTrackingRow(
            "PO-1", property, Done, Line(key: 5m), Now.AddDays(-1), invoice, true, flag, 3);

        Assert.Equal("R-2 — حي", row.PropertyLabel);
        Assert.Equal("D-1", row.DeedNumber);
        Assert.Equal("الرياض", row.City);
        Assert.Equal("500", row.LandArea);
        Assert.Equal(bourse, row.CompletedAtUtc);
        Assert.True(row.EnfazFilled);
        Assert.Equal(155m, row.EnfazFeeSar);
        Assert.Equal("INV-1", row.InvoiceNumber);
        Assert.Equal(10m, row.CollectedAmountSar);
        Assert.True(row.IsOverdue);
        Assert.Equal(PoEnfazFinanceFlagKind.Stopped, row.FinanceFlag);
        Assert.Equal("n", row.FinanceFlagNote);
        Assert.Equal(3, row.FollowupCount);

        var inProgress = (InspectorFeeWorkStatuses.InProgress, "x");
        var pending = PoEnfazRevenueRules.ToTrackingRow(
            "PO-1", Property(), inProgress, null, Now.AddDays(-1), null, false, null, 0);
        Assert.Null(pending.CompletedAtUtc);
        Assert.False(pending.EnfazFilled);
        Assert.Null(pending.InvoiceNumber);
        Assert.Null(pending.FinanceFlag);
    }

    [Fact]
    public void Tracking_row_falls_back_to_the_last_completed_task()
    {
        var taskDone = Now.AddDays(-2);
        var row = PoEnfazRevenueRules.ToTrackingRow(
            "PO-1", Property(), Done, null, taskDone, null, false, null, 0);

        Assert.Equal(taskDone, row.CompletedAtUtc);
    }
}
