using RealEstateEval.Attachments.Application.Rules;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Valuation.Application.Rules;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>The wording, keys and tones of the milestones the report, document, failure and return steps write.</summary>
public class TimelineMilestoneTextsTests
{
    private static readonly Guid Property = Guid.NewGuid();
    private static readonly Guid Request = Guid.NewGuid();
    private static readonly DateTime T = new(2026, 10, 7, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void A_repeated_report_step_gets_a_new_key_each_time()
    {
        var first = ValuationTimelineTexts.DraftSent("PO-1", Property, Request, "س", null, T);
        var second = ValuationTimelineTexts.DraftSent("PO-1", Property, Request, "س", null, T.AddHours(1));

        Assert.NotEqual(first.EventKey, second.EventKey);
        Assert.Equal(first.Title, second.Title);
    }

    [Fact]
    public void The_report_cycle_names_who_and_what()
    {
        Assert.Equal(
            "المقيّم · تاريخ التقرير 2026-10-07",
            ValuationTimelineTexts.Approved("PO-1", Property, Request, "المقيّم", "2026-10-07", T).Detail);
        Assert.Equal(
            "الرمز D-77 · المقيّم",
            ValuationTimelineTexts.Deposit("PO-1", Property, Request, "المقيّم", "D-77", T).Detail);
        Assert.Equal(
            "الأخصائي — بيانات ناقصة",
            ValuationTimelineTexts.NewVersion("PO-1", Property, Request, "الأخصائي", "بيانات ناقصة", T).Detail);
        Assert.Null(ValuationTimelineTexts.DraftSent("PO-1", Property, Request, null, "  ", T).Detail);
    }

    [Fact]
    public void Backward_moves_are_warnings_and_forward_ones_are_done()
    {
        Assert.Equal(PropertyTimelineTones.Done,
            ValuationTimelineTexts.Approved("PO-1", Property, Request, null, null, T).Tone);
        Assert.Equal(PropertyTimelineTones.Warn,
            ValuationTimelineTexts.ApprovalWithdrawn("PO-1", Property, Request, null, null, T).Tone);
        Assert.Equal(PropertyTimelineTones.Warn,
            ValuationTimelineTexts.NewVersion("PO-1", Property, Request, null, null, T).Tone);
        Assert.Equal(PropertyTimelineTones.Done,
            ValuationTimelineTexts.RecallDecided("PO-1", Property, Request, approved: true, null, T).Tone);
        Assert.Equal(PropertyTimelineTones.Warn,
            ValuationTimelineTexts.RecallDecided("PO-1", Property, Request, approved: false, "لا", T).Tone);
    }

    [Fact]
    public void A_valued_document_scope_key_gives_the_po_and_property()
    {
        Assert.Equal(("PO-7", Property), ValuedDocumentTimelineRules.ParseScopeKey($"PO-7:{Property:D}"));
        Assert.Null(ValuedDocumentTimelineRules.ParseScopeKey("PO-7:not-a-guid"));
        Assert.Null(ValuedDocumentTimelineRules.ParseScopeKey(Property.ToString("D")));
        Assert.Null(ValuedDocumentTimelineRules.ParseScopeKey(null));
    }

    [Fact]
    public void Valued_document_milestones_name_the_document_and_the_decision()
    {
        var id = Guid.NewGuid();
        var key = $"PO-7:{Property:D}";

        var uploaded = ValuedDocumentTimelineRules.Uploaded(key, id, "عقد بيع", T)!;
        Assert.Equal(ValuedDocumentTimelineRules.UploadedTitleAr, uploaded.Title);
        Assert.Equal("عقد بيع", uploaded.Detail);
        Assert.Equal("PO-7", uploaded.PoNumber);

        var rejected = ValuedDocumentTimelineRules.Reviewed(key, id, approved: false, "عقد بيع", "غير مقروء", T)!;
        Assert.Equal(ValuedDocumentTimelineRules.RejectedTitleAr, rejected.Title);
        Assert.Equal("عقد بيع — غير مقروء", rejected.Detail);
        Assert.Equal(PropertyTimelineTones.Warn, rejected.Tone);

        Assert.Null(ValuedDocumentTimelineRules.Uploaded("garbage", id, "x", T));
    }

    [Theory]
    [InlineData(WorkflowTaskKind.FieldInspection, "إعادة المعاينة للتصحيح")]
    [InlineData(WorkflowTaskKind.PropertyAppraisal, "إعادة التقييم للتصحيح")]
    [InlineData(WorkflowTaskKind.EngineeringSurvey, "إعادة الرفع المساحي للتصحيح")]
    public void A_package_returned_for_correction_is_named_by_its_party(WorkflowTaskKind kind, string expected)
    {
        Assert.Equal(expected, PartyTaskSubmissionRules.ReturnedForCorrectionTitle(kind));
    }

    [Fact]
    public void The_return_detail_names_the_specialist_and_the_note()
    {
        Assert.Equal("أسامة — أكمل البيانات", PartyTaskSubmissionRules.ReturnedForCorrectionDetail("أسامة", "أكمل البيانات"));
        Assert.Equal("أكمل البيانات", PartyTaskSubmissionRules.ReturnedForCorrectionDetail(null, "أكمل البيانات"));
        Assert.Null(PartyTaskSubmissionRules.ReturnedForCorrectionDetail(" ", null));
    }

    [Fact]
    public void A_failure_stage_key_carries_the_time()
    {
        var failure = PropertyFailure.Create(
            Guid.NewGuid(), "PO-1", Property, "D-1", "عنوان", "pt", "high", "case-specialist", "", "أسامة", T);

        var first = FailureRules.StageTimelineEntry(failure, "approved", FailureRules.ApprovedTitleAr, "ملاحظة", PropertyTimelineTones.Warn, T);
        var second = FailureRules.StageTimelineEntry(failure, "approved", FailureRules.ApprovedTitleAr, "ملاحظة", PropertyTimelineTones.Warn, T.AddDays(1));

        Assert.NotEqual(first.EventKey, second.EventKey);
        Assert.StartsWith($"failure:{failure.Id}:approved:", first.EventKey);
        Assert.Equal("PO-1", first.PoNumber);
    }
}
