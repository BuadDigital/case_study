using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Attachments.Application.Rules;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class PoRoleMatrixRulesTests
{
    [Theory]
    [InlineData("case-specialist", true)]
    [InlineData("section-supervisor", false)]
    [InlineData("general-manager", false)]
    [InlineData("field-inspector", false)]
    [InlineData("cdo", true)]
    [InlineData("", false)]
    public void CanEditProperty_matches_frontend(string role, bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.CanEditProperty(role));
    }

    [Theory]
    [InlineData("case-specialist", true)]
    [InlineData("section-supervisor", true)]
    [InlineData("cdo", false)]
    [InlineData("general-manager", false)]
    [InlineData("field-inspector", false)]
    [InlineData("real-estate-appraiser", false)]
    public void CanReceivePo_is_specialist_and_supervisor_only(string role, bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.CanReceivePo(role));
    }

    [Theory]
    [InlineData("section-supervisor", true)]
    [InlineData("case-specialist", true)]
    [InlineData("cdo", true)]
    [InlineData("general-manager", false)]
    [InlineData("field-inspector", false)]
    public void CanRevertTaskPhase_is_specialist_cdo_and_supervisor(string role, bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.CanRevertTaskPhase(role));
    }

    [Theory]
    [InlineData("case-specialist", true)]
    [InlineData("section-supervisor", false)]
    [InlineData("general-manager", false)]
    [InlineData("cdo", false)]
    [InlineData("real-estate-appraiser", false)]
    [InlineData("", false)]
    public void Specialist_decisions_belong_to_the_case_specialist_only(string role, bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.CanIssueCaseStudyReport(role));
        Assert.Equal(expected, PoRoleMatrixRules.CanReopenCaseStudyReport(role));
        Assert.Equal(expected, PoRoleMatrixRules.CanDecideAppraisalRecall(role));
        Assert.Equal(expected, PoRoleMatrixRules.CanHandOverToEnfaz(role));
        Assert.Equal(expected, PoRoleMatrixRules.CanReturnFromEnfaz(role));
        Assert.Equal(expected, PoRoleMatrixRules.CanLiftSurveyFreeze(role));
        Assert.Equal(expected, PoRoleMatrixRules.CanPrepareReportDraft(role));
        Assert.Equal(expected, PoRoleMatrixRules.CanReopenValuationReport(role));
    }

    [Theory]
    [InlineData("val-abdullah", "u-1", "val-abdullah", true)]
    [InlineData("val-abdullah", "val-abdullah", null, true)]
    [InlineData("val-abdullah", "u-1", "val-other", false)]
    [InlineData("val-abdullah", "u-1", null, false)]
    [InlineData(null, "u-1", "val-abdullah", false)]
    [InlineData("  ", "u-1", "  ", false)]
    public void The_report_draft_review_is_the_assigned_appraisers_alone(
        string? assigneeId, string? userId, string? distributionId, bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.IsAssignedPartyUser(assigneeId, userId, distributionId));
    }

    [Theory]
    // Neither phase nor status: open to every work-order manager.
    [InlineData("general-manager", null, null, true)]
    [InlineData("cdo", null, null, true)]
    // The roles that run the lifecycle may move phase / status.
    [InlineData("case-specialist", "done", "completed", true)]
    [InlineData("section-supervisor", "bourse", "open", true)]
    // GM / CDO only suspend.
    [InlineData("cdo", null, "blocked", true)]
    [InlineData("general-manager", null, "blocked", true)]
    [InlineData("cdo", null, "completed", false)]
    [InlineData("general-manager", "done", "completed", false)]
    [InlineData("cdo", "bourse", "blocked", false)]
    [InlineData("field-inspector", null, "blocked", false)]
    // ... and resolve an obstruction: reopen to a working phase, never to «done».
    [InlineData("cdo", "bourse", "open", true)]
    [InlineData("general-manager", "case-study", "open", true)]
    [InlineData("general-manager", null, "open", true)]
    [InlineData("cdo", "done", "open", false)]
    [InlineData("field-inspector", "bourse", "open", false)]
    public void CanPatchTaskLifecycle_limits_phase_and_status_changes(
        string role,
        string? phase,
        string? status,
        bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.CanPatchTaskLifecycle(role, phase, status));
    }

    [Theory]
    [InlineData("section-supervisor", true)]
    [InlineData("case-specialist", false)]
    [InlineData("general-manager", false)]
    [InlineData("cdo", true)]
    public void CanEditPoHeader_matches_frontend(string role, bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.CanEditPoHeader(role));
    }

    [Theory]
    [InlineData("section-supervisor", true)]
    [InlineData("case-specialist", false)]
    [InlineData("cdo", true)]
    public void CanDeletePo_matches_frontend(string role, bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.CanDeletePo(role));
    }

    [Theory]
    [InlineData("case-specialist", true)]
    [InlineData("section-supervisor", true)]
    [InlineData("general-manager", true)]
    [InlineData("field-inspector", false)]
    [InlineData("engineering-office", false)]
    public void CanManagePartySubmissions_allows_specialists(string role, bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.CanManagePartySubmissions(role));
    }

    [Fact]
    public void CanWritePartyTask_allows_matching_distribution_assignee()
    {
        Assert.True(PoRoleMatrixRules.CanWritePartyTask(
            "field-inspector",
            taskAssigneeId: "dist-1",
            actorUserId: "user-x",
            actorDistributionAssigneeId: "dist-1"));
    }

    [Fact]
    public void CanWritePartyTask_forbids_other_party()
    {
        Assert.False(PoRoleMatrixRules.CanWritePartyTask(
            "field-inspector",
            taskAssigneeId: "dist-1",
            actorUserId: "user-x",
            actorDistributionAssigneeId: "dist-other"));
    }

    [Fact]
    public void CanWritePartyTask_allows_supervisor_override()
    {
        Assert.True(PoRoleMatrixRules.CanWritePartyTask(
            "section-supervisor",
            taskAssigneeId: "dist-1",
            actorUserId: "sup-1",
            actorDistributionAssigneeId: null));
    }

    [Theory]
    [InlineData("case-specialist", true)]
    [InlineData("section-supervisor", true)]
    [InlineData("general-manager", true)]
    [InlineData("cdo", true)]
    [InlineData("field-inspector", false)]
    [InlineData("real-estate-appraiser", false)]
    public void CanCorrectFieldInspectionSubmission_matches_case_staff(string role, bool expected)
    {
        Assert.Equal(expected, PoRoleMatrixRules.CanCorrectFieldInspectionSubmission(role));
    }

    [Theory]
    [InlineData("case-specialist")]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    [InlineData("cdo")]
    public void CanReadPartyTask_allows_case_staff_on_any_task(string role)
    {
        Assert.True(PoRoleMatrixRules.CanReadPartyTask(
            role,
            taskAssigneeId: "dist-1",
            actorUserId: "staff-1",
            actorDistributionAssigneeId: null));
    }

    [Fact]
    public void CanReadPartyTask_allows_assigned_party()
    {
        Assert.True(PoRoleMatrixRules.CanReadPartyTask(
            "engineering-office",
            taskAssigneeId: "dist-1",
            actorUserId: "user-x",
            actorDistributionAssigneeId: "dist-1"));
    }

    [Fact]
    public void CanReadPartyTask_forbids_other_party()
    {
        Assert.False(PoRoleMatrixRules.CanReadPartyTask(
            "engineering-office",
            taskAssigneeId: "dist-1",
            actorUserId: "user-x",
            actorDistributionAssigneeId: "dist-other"));
    }

    [Fact]
    public void CanReadPartyTask_forbids_party_on_unassigned_task()
    {
        Assert.False(PoRoleMatrixRules.CanReadPartyTask(
            "field-inspector",
            taskAssigneeId: null,
            actorUserId: "user-x",
            actorDistributionAssigneeId: "dist-1"));
    }
}

public class AttachmentUploadRulesTests
{
    [Fact]
    public void Rejects_oversized_image_for_keys_proof()
    {
        var error = AttachmentUploadRules.Validate(
            "government-keys-proof",
            "image/jpeg",
            AttachmentUploadRules.ImageMaxBytes + 1);
        Assert.NotNull(error);
    }

    [Fact]
    public void Accepts_pdf_within_limit()
    {
        var error = AttachmentUploadRules.Validate(
            "engineering-survey-report",
            "application/pdf",
            1024,
            "report.pdf");
        Assert.Null(error);
    }

    [Fact]
    public void Rejects_exe_for_property_docs()
    {
        var error = AttachmentUploadRules.Validate(
            "property-registry",
            "application/octet-stream",
            100,
            "virus.exe");
        Assert.NotNull(error);
    }
}

public class CaseStudyAnswerProvenanceTests
{
    [Fact]
    public void MergeChanged_stamps_only_changed_keys_and_preserves_others()
    {
        var existing = new Dictionary<string, AnswerProvenanceEntryDto>
        {
            ["deed_1"] = new()
            {
                Value = "A",
                AnsweredByUserId = "u-old",
                AnsweredByName = "قديم",
                WorkflowTaskId = "task-1",
                AnsweredAtUtc = "2020-01-01T00:00:00Z",
            },
        };

        var previous = new Dictionary<string, string?>
        {
            ["deed_1"] = "A",
            ["deed_2"] = null,
        };
        var next = new Dictionary<string, string?>
        {
            ["deed_1"] = "A",
            ["deed_2"] = "B",
        };

        var actor = new CaseStudyReportActor
        {
            UserId = "u-new",
            DisplayName = "جديد",
            PrototypeRole = "field-inspector",
        };

        var merged = CaseStudyAnswerProvenance.MergeChanged(
            existing,
            previous,
            next,
            actor,
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            "insp",
            DateTime.UtcNow);

        Assert.Equal("u-old", merged["deed_1"].AnsweredByUserId);
        Assert.Equal("B", merged["deed_2"].Value);
        Assert.Equal("u-new", merged["deed_2"].AnsweredByUserId);
        Assert.Equal("insp", merged["deed_2"].SourcePartyId);
        Assert.Equal("field-inspector", merged["deed_2"].SourceRole);
    }
}
