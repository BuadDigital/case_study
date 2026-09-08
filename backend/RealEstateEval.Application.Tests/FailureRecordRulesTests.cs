using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Application.Tests;

public class FailureRecordRulesTests
{
    private static readonly DateTime Now = new(2026, 5, 4, 12, 0, 0, DateTimeKind.Utc);
    private const string SpecialistUserId = "dddddddd-dddd-dddd-dddd-dddddddddddd";

    private static PropertyFailure Failure(
        string title = "عنوان",
        string internalNote = "ملاحظة",
        string status = PropertyFailureStatus.Internal,
        string specialist = "سالم",
        string raisedByRole = "الأخصائي",
        DateTime? suspendedAtUtc = null,
        string? suspendedByUserId = null) =>
        PropertyFailure.Reconstitute(
            Guid.NewGuid(),
            "PO-1",
            Guid.NewGuid(),
            "D-1",
            title,
            "deed-inactive",
            PropertyFailureSeverity.Internal,
            raisedByRole,
            internalNote,
            "",
            status,
            specialist,
            Now,
            Now,
            suspendedAtUtc,
            suspendedByUserId);

    // ---- guards ----

    [Fact]
    public void A_bourse_obstruction_needs_a_reason()
    {
        var errors = FailureRecordRules.ValidateBourseObstruction(
            new BourseObstructionRequest { Reason = "   " });

        Assert.NotNull(errors);
        Assert.Equal("سبب التعذر مطلوب", errors!["reason"]);
        Assert.Null(FailureRecordRules.ValidateBourseObstruction(
            new BourseObstructionRequest { Reason = "الصك موقوف" }));
    }

    [Fact]
    public void The_create_target_must_exist_and_not_be_removed()
    {
        var missing = FailureRecordRules.ValidateCreateTarget([]);
        Assert.Equal("العقار غير موجود", missing!["propertyId"]);

        var removed = FailureRecordRules.ValidateCreateTarget(
            [new CaseStudyPropertySnapshotDto { IsRemoved = true }]);
        Assert.Equal("لا يمكن تسجيل تعذر على عقار محذوف", removed!["propertyId"]);

        Assert.Null(FailureRecordRules.ValidateCreateTarget([new CaseStudyPropertySnapshotDto()]));
    }

    [Theory]
    [InlineData(PropertyFailureStatus.Internal, true)]
    [InlineData(PropertyFailureStatus.Review, true)]
    [InlineData(PropertyFailureStatus.Approved, true)]
    [InlineData(PropertyFailureStatus.Suspended, false)]
    public void Only_a_failure_not_yet_suspended_is_refreshed_into_the_eviction_hold(
        string status,
        bool expected)
    {
        Assert.Equal(expected, FailureRecordRules.NeedsEvictionRefresh(Failure(status: status)));
    }

    [Fact]
    public void The_internal_obstruction_reason_is_the_trimmed_title_or_note()
    {
        Assert.Equal("عنوان", FailureRecordRules.InternalObstructionReason(Failure(title: " عنوان ")));
        Assert.Equal(
            "ملاحظة",
            FailureRecordRules.InternalObstructionReason(Failure(title: "  ", internalNote: " ملاحظة ")));
    }

    // ---- requests ----

    [Fact]
    public void A_hold_task_request_carries_the_keys_and_an_optional_reason()
    {
        var propertyId = Guid.NewGuid();

        var block = FailureRecordRules.HoldTaskRequest("PO-2", propertyId, "محظر إخلاء");
        Assert.Equal("PO-2", block.PoNumber);
        Assert.Equal(propertyId, block.PropertyId);
        Assert.Equal("محظر إخلاء", block.Reason);

        Assert.Equal("", FailureRecordRules.HoldTaskRequest("PO-2", propertyId).Reason);
    }

    [Fact]
    public void Deed_statuses_are_the_persisted_arabic_values()
    {
        Assert.Equal("فعال", FailureRecordRules.DeedStatusActive);
        Assert.Equal("موقوف", FailureRecordRules.DeedStatusSuspended);
        Assert.Equal("قيد التحقق", FailureRecordRules.DeedStatusUnderVerification);
    }

    // ---- wire record ----

    [Fact]
    public void The_record_carries_ids_dates_and_suspension_as_strings()
    {
        var failure = Failure(suspendedAtUtc: Now, suspendedByUserId: "u-9");

        var dto = FailureRecordRules.ToDto(failure);

        Assert.Equal(failure.Id.ToString(), dto.Id);
        Assert.Equal(failure.PropertyId.ToString("D"), dto.PropertyId);
        Assert.Equal("PO-1", dto.PoNumber);
        Assert.Equal("D-1", dto.DeedNumber);
        Assert.Equal(PropertyFailureStatus.Internal, dto.Status);
        Assert.Equal(Now.ToString("O"), dto.CreatedAt);
        Assert.Equal(Now.ToString("O"), dto.UpdatedAt);
        Assert.Equal(Now.ToString("O"), dto.SuspendedAt);
        Assert.Equal("u-9", dto.SuspendedByUserId);
    }

    [Fact]
    public void An_unsuspended_record_has_no_suspension_fields()
    {
        var dto = FailureRecordRules.ToDto(Failure());

        Assert.Null(dto.SuspendedAt);
        Assert.Null(dto.SuspendedByUserId);
    }

    [Fact]
    public void System_labels_are_normalised_when_no_names_are_supplied()
    {
        var dto = FailureRecordRules.ToDto(Failure(specialist: "system", raisedByRole: "SYSTEM"));

        Assert.Equal(DocumentaryWorkflowRules.SystemRaiserRole, dto.Specialist);
        Assert.Equal(DocumentaryWorkflowRules.SystemRaiserRole, dto.RaisedByRole);
    }

    [Fact]
    public void A_specialist_user_id_is_swapped_for_the_resolved_name()
    {
        var names = new Dictionary<string, string> { [SpecialistUserId] = "نورة" };

        var resolved = FailureRecordRules.ToDto(Failure(specialist: SpecialistUserId), names);
        Assert.Equal("نورة", resolved.Specialist);

        var unresolved = FailureRecordRules.ToDto(
            Failure(specialist: SpecialistUserId),
            new Dictionary<string, string>());
        Assert.Equal(SpecialistUserId, unresolved.Specialist);

        var plainName = FailureRecordRules.ToDto(Failure(specialist: "سالم"), names);
        Assert.Equal("سالم", plainName.Specialist);
    }
}
