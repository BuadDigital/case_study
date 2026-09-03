using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>B2: The life cycle of limbs, tags, and versioning within the roots, not services.</summary>
public class PartyTaskSubmissionAggregateTests
{
    private static readonly DateTime Now = new(2026, 8, 28, 10, 0, 0, DateTimeKind.Utc);

    private static PartyTaskSubmission Draft() =>
        PartyTaskSubmission.CreateDraft(
            Guid.NewGuid(), "field-inspection", Guid.NewGuid(), "PO-1", Now);

    [Fact]
    public void Draft_cannot_be_submitted_through_the_draft_path()
    {
        var entity = Draft();
        var error = entity.SaveDraft("{}", PartyTaskSubmissionStatus.Submitted, null, null, Now);
        Assert.Equal("استخدم نقطة الإرسال لتقديم العمل", error);
        Assert.Equal(PartyTaskSubmissionStatus.Draft, entity.Status);
    }

    [Fact]
    public void Reopened_stays_reopened_on_draft_saves_until_resubmitted()
    {
        var entity = Draft();
        Assert.True(entity.Submit(Now, "u1", "الاسم", "بديل"));
        Assert.Null(entity.ReturnForCorrection("ملاحظة", Now, "u2", "الأخصائي"));

        Assert.Null(entity.SaveDraft("{}", PartyTaskSubmissionStatus.Reopened, null, null, Now));
        Assert.Equal(PartyTaskSubmissionStatus.Reopened, entity.Status);
    }

    [Fact]
    public void Submit_is_idempotent_and_stamps_actor()
    {
        var entity = Draft();
        Assert.True(entity.Submit(Now, "u1", "  المعاين  ", "بديل"));
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, entity.Status);
        Assert.Equal("المعاين", entity.SubmittedByName);
        Assert.Equal(Now, entity.SubmittedAtUtc);

        // Duplicate sending doesn't change anything.
        Assert.False(entity.Submit(Now.AddHours(1), "u2", "آخر", "بديل"));
        Assert.Equal("u1", entity.SubmittedByUserId);
    }

    [Fact]
    public void Return_for_correction_requires_submitted_and_voids_acceptance()
    {
        var entity = Draft();
        Assert.NotNull(entity.ReturnForCorrection("ملاحظة", Now, "u1", null));

        entity.Submit(Now, "u1", "المعاين", "بديل");
        Assert.Null(entity.Accept(Now, "specialist", "الأخصائي"));
        Assert.NotNull(entity.AcceptedAtUtc);

        Assert.Null(entity.ReturnForCorrection("صحّح الصور", Now, "u2", "الأخصائي"));
        Assert.Equal(PartyTaskSubmissionStatus.Reopened, entity.Status);
        Assert.Null(entity.AcceptedAtUtc);
        Assert.Null(entity.AcceptedByUserId);
        Assert.Null(entity.SubmittedAtUtc);
        Assert.Equal("صحّح الصور", entity.ReturnNote);
    }

    [Fact]
    public void Accept_requires_submitted_and_keeps_the_first_stamp()
    {
        var entity = Draft();
        Assert.NotNull(entity.Accept(Now, "s1", null));

        entity.Submit(Now, "u1", "المعاين", "بديل");
        Assert.Null(entity.Accept(Now, "s1", "الأخصائي"));
        Assert.Null(entity.Accept(Now.AddHours(2), "s2", "غيره"));
        Assert.Equal("s1", entity.AcceptedByUserId);
        Assert.Equal(Now, entity.AcceptedAtUtc);
    }

    [Fact]
    public void Comparable_quality_tags_enforce_substantive_rationale_inside_the_root()
    {
        var comp = new ComparableProperty { Id = Guid.NewGuid() };

        // Unwarranted tagging - rejected.
        var missing = comp.ApplyQualityTags(
            ComparableReliabilityTags.Anomalous, false, "", "u1", Now);
        Assert.Equal("tagRationale", missing!.Value.Field);

        // Placeholder rationale — rejected (Q-8-2).
        var sham = comp.ApplyQualityTags(
            ComparableReliabilityTags.Anomalous, false, ".", "u1", Now);
        Assert.Equal("tagRationale", sham!.Value.Field);
        Assert.Contains("الحد الأدنى", sham.Value.MessageAr);

        // Intact tag — dated with the name of its author.
        Assert.Null(comp.ApplyQualityTags(
            ComparableReliabilityTags.Anomalous, false, "سعر شاذ عن سائد الحي", "u1", Now));
        Assert.True(comp.IsExcludedFromSuggestions);
        Assert.Equal("u1", comp.TaggedByUserId);

        // Removing all tags erases the trace.
        Assert.Null(comp.ApplyQualityTags(
            ComparableReliabilityTags.Normal, false, null, "u1", Now));
        Assert.False(comp.IsExcludedFromSuggestions);
        Assert.Null(comp.TagRationale);
        Assert.Null(comp.TaggedByUserId);
        Assert.Null(comp.TaggedAtUtc);
    }

    [Fact]
    public void Report_issuance_final_requires_a_registered_code()
    {
        var row = ValuationReportIssuance.IssueDeposit(
            Guid.NewGuid(), "{}", [1, 2, 3], "u1", Now);
        Assert.Equal(ReportIssuanceStages.DepositIssued, RowStage(row));

        Assert.NotNull(row.IssueFinal([9], Now));

        Assert.Equal("رمز الإيداع مطلوب", row.RegisterCertificate("  ", null, null, null, "u2", Now));
        Assert.Null(row.RegisterCertificate("QYM-1", "c.png", "image/png", [7], "u2", Now));
        Assert.Null(row.IssueFinal([9], Now));
        Assert.Equal(ReportIssuanceStages.FinalIssued, RowStage(row));
    }

    private static string RowStage(ValuationReportIssuance row) =>
        row.FinalIssuedAtUtc is not null
            ? ReportIssuanceStages.FinalIssued
            : ReportIssuanceStages.DepositIssued;
}
