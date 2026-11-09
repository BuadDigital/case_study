using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Application.Rules;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Omar's ruling 2026-11-02: the case specialist holds one or more sub-roles (coordination /
/// study / review), carried in the token, and each specialist decision belongs to one of them.
/// </summary>
public sealed class CaseSpecialistSubRolesTests
{
    private const string Coordination = CaseSpecialistSubRoles.Coordination;
    private const string Study = CaseSpecialistSubRoles.Study;
    private const string Review = CaseSpecialistSubRoles.Review;

    // ---- vocabulary ----

    [Fact]
    public void Words_and_flags_round_trip_in_a_fixed_order()
    {
        Assert.Equal(7, CaseSpecialistSubRoles.ToFlags(["review", " Study ", "coordination"]));
        Assert.Equal(0, CaseSpecialistSubRoles.ToFlags(["unknown"]));
        Assert.Equal(0, CaseSpecialistSubRoles.ToFlags(null));
        Assert.Equal(new[] { Coordination, Review }, CaseSpecialistSubRoles.FromFlags(5));
        Assert.Empty(CaseSpecialistSubRoles.FromFlags(0));
        Assert.Equal("دراسة العقار", CaseSpecialistSubRoles.LabelAr(Study));
    }

    // ---- the role matrix ----

    public static TheoryData<string, Func<StaffActor, bool>> Decisions => new()
    {
        { Coordination, a => PoRoleMatrixRules.CanReceivePo(a) },
        { Coordination, a => PoRoleMatrixRules.CanEditAssignmentSpecialist(a) },
        { Coordination, a => PoRoleMatrixRules.CanAdvanceIntake(a) },
        { Coordination, a => PoRoleMatrixRules.CanRevertTaskPhase(a) },
        { Coordination, a => PoRoleMatrixRules.CanDistribute(a) },
        { Coordination, a => PoRoleMatrixRules.CanPatchTaskLifecycle(a, "case-study", "blocked") },
        { Coordination, a => PoRoleMatrixRules.CanRequestTransactionCancel(a) },
        { Coordination, a => PoRoleMatrixRules.CanManageOperationsTasks(a) },
        { Coordination, a => PoRoleMatrixRules.CanLiftSurveyFreeze(a) },
        { Coordination, a => PoRoleMatrixRules.CanFollowUpFailure(a) },
        { Study, a => PoRoleMatrixRules.CanFinishStudy(a) },
        { Study, a => PoRoleMatrixRules.CanDecideAppraisalRecall(a) },
        { Study, a => PoRoleMatrixRules.CanPrepareReportDraft(a) },
        { Study, a => PoRoleMatrixRules.CanReviewValuedDocuments(a) },
        { Review, a => PoRoleMatrixRules.CanHandOverToEnfaz(a) },
        { Review, a => PoRoleMatrixRules.CanReturnFromEnfaz(a) },
        { Review, a => PoRoleMatrixRules.CanRecordValuationDeposit(a) },
        { Review, a => PoRoleMatrixRules.CanReopenValuationReport(a) },
    };

    [Theory]
    [MemberData(nameof(Decisions))]
    public void Each_specialist_decision_belongs_to_its_sub_role(string owner, Func<StaffActor, bool> decision)
    {
        foreach (var held in CaseSpecialistSubRoles.All)
        {
            var actor = new StaffActor(StaffRoleIds.CaseSpecialist, [held]);
            Assert.Equal(held == owner, decision(actor));
        }

        Assert.True(decision(new StaffActor(StaffRoleIds.CaseSpecialist, CaseSpecialistSubRoles.All)));
        Assert.False(decision(new StaffActor(StaffRoleIds.CaseSpecialist, [])));
    }

    /// <summary>
    /// Omar 2026-11-08: the three sub-roles see all of the transaction's data and edit it at the same
    /// level — the party work's corrections and acceptance included.
    /// </summary>
    [Theory]
    [InlineData(Coordination, true)]
    [InlineData(Study, true)]
    [InlineData(Review, true)]
    public void Party_work_is_accepted_by_coordination_and_the_study(string held, bool expected)
    {
        var actor = new StaffActor(StaffRoleIds.CaseSpecialist, [held]);
        Assert.Equal(expected, PoRoleMatrixRules.CanAcceptPartyWork(actor));
        Assert.Equal(expected, PoRoleMatrixRules.CanCorrectFieldInspectionSubmission(actor));
    }

    /// <summary>Omar 2026-11-08: the study takes its study back from review; review returns it to the study.</summary>
    [Theory]
    [InlineData(Coordination, false)]
    [InlineData(Study, true)]
    [InlineData(Review, true)]
    public void The_study_is_reopened_by_the_study_or_by_review(string held, bool expected) =>
        Assert.Equal(expected, PoRoleMatrixRules.CanReopenCaseStudyReport(new StaffActor(StaffRoleIds.CaseSpecialist, [held])));

    [Fact]
    public void Sub_roles_never_reach_another_role()
    {
        var inspector = new StaffActor(StaffRoleIds.FieldInspector, CaseSpecialistSubRoles.All);
        Assert.False(inspector.HoldsCoordination);
        Assert.False(PoRoleMatrixRules.CanFinishStudy(inspector));
        Assert.False(PoRoleMatrixRules.CanHandOverToEnfaz(inspector));
    }

    [Fact]
    public void Management_keeps_its_pre_split_access()
    {
        var supervisor = new StaffActor(StaffRoleIds.SectionSupervisor, []);
        var cdo = new StaffActor(StaffRoleIds.Cdo, []);

        Assert.True(PoRoleMatrixRules.CanReceivePo(supervisor));
        Assert.True(PoRoleMatrixRules.CanAcceptPartyWork(supervisor));
        Assert.True(PoRoleMatrixRules.CanDistribute(supervisor));
        Assert.True(PoRoleMatrixRules.CanAdvanceIntake(cdo));
        Assert.True(PoRoleMatrixRules.CanEditPropertyData(cdo));
        // The specialist decisions stay the specialist's.
        Assert.False(PoRoleMatrixRules.CanFinishStudy(supervisor));
        Assert.False(PoRoleMatrixRules.CanHandOverToEnfaz(cdo));
    }

    [Theory]
    [InlineData(Coordination)]
    [InlineData(Study)]
    [InlineData(Review)]
    public void Every_sub_role_edits_property_data(string held)
    {
        Assert.True(PoRoleMatrixRules.CanEditPropertyData(new StaffActor(StaffRoleIds.CaseSpecialist, [held])));
        Assert.False(PoRoleMatrixRules.CanEditPropertyData(new StaffActor(StaffRoleIds.FieldInspector, [])));
    }

    [Fact]
    public void Merging_is_for_coordination_or_study_not_review()
    {
        Assert.True(PoRoleMatrixRules.CanMergeTransactions(new StaffActor(StaffRoleIds.CaseSpecialist, [Coordination])));
        Assert.True(PoRoleMatrixRules.CanMergeTransactions(new StaffActor(StaffRoleIds.CaseSpecialist, [Study])));
        Assert.False(PoRoleMatrixRules.CanMergeTransactions(new StaffActor(StaffRoleIds.CaseSpecialist, [Review])));
    }

    // ---- the user card ----

    [Theory]
    [InlineData("case-specialist", null, 0, 7)]
    [InlineData("case-specialist", null, 2, 2)]
    [InlineData("case-specialist", "study,review", 7, 6)]
    [InlineData("field-inspector", "study", 7, 0)]
    [InlineData("case-specialist", "", 7, 0)]
    public void Stored_flags_follow_the_role_and_the_request(string role, string? requested, int stored, int expected)
    {
        IReadOnlyList<string>? list = requested?.Split(',', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(expected, StaffProfileRules.SubRoleFlagsFor(role, list, stored));
    }

    [Fact]
    public void An_empty_or_unknown_list_is_refused()
    {
        Assert.Null(StaffProfileRules.SubRolesError(null));
        Assert.Null(StaffProfileRules.SubRolesError([Study]));
        Assert.Equal(StaffProfileRules.SubRolesRequiredAr, StaffProfileRules.SubRolesError([]));
        Assert.Equal(StaffProfileRules.SubRolesUnknownAr, StaffProfileRules.SubRolesError(["boss"]));
    }

    [Fact]
    public void A_specialist_left_without_sub_roles_fails_validation()
    {
        var target = new StaffUpdateTarget(
            RoleId: StaffRoleIds.CaseSpecialist,
            DisplayName: "أخصائي",
            Email: null,
            Mobile: "+966500000000",
            City: "الرياض",
            NationalId: "1000000091",
            InspectorType: null,
            CaseSpecialistSubRoles: 0,
            HasCompensation: false,
            FeeValueSar: null,
            Iban: null,
            AvatarUrl: null,
            TaxNumber: null,
            CommercialRegistration: null,
            JoinedAt: null,
            Status: UserStatus.Active);

        Assert.Equal(
            StaffProfileRules.SubRolesRequiredAr,
            StaffProfileRules.ValidateUpdateTarget(target)["caseSpecialistSubRoles"]);
    }

    // ---- token ----

    [Fact]
    public void The_token_carries_one_claim_per_sub_role()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "RealEstateEval.Tests",
                ["Jwt:Audience"] = "RealEstateEval.Tests",
                ["Jwt:SigningKey"] = "test-signing-key-that-is-longer-than-sixty-four-characters-1234567890",
            })
            .Build();
        var (token, _) = new JwtTokenService(configuration).CreateToken(
            new TokenSubject("u-1", "أخصائي"),
            [],
            prototypeRole: StaffRoleIds.CaseSpecialist,
            subRoles: [Study, "bogus", Review]);

        var claims = new JwtSecurityTokenHandler().ReadJwtToken(token).Claims
            .Where(c => c.Type == CaseSpecialistSubRoles.ClaimType)
            .Select(c => c.Value);
        Assert.Equal(new[] { Study, Review }, claims);
    }

    [Fact]
    public void Claims_are_read_back_and_an_old_specialist_token_holds_everything()
    {
        static ClaimsPrincipal Principal(params Claim[] claims) => new(new ClaimsIdentity(claims, "test"));

        Assert.Equal(
            new[] { Study },
            ClaimsPermissionService.SubRolesFrom(
                Principal(new Claim(CaseSpecialistSubRoles.ClaimType, Study)),
                StaffRoleIds.CaseSpecialist));
        Assert.Equal(
            CaseSpecialistSubRoles.All,
            ClaimsPermissionService.SubRolesFrom(Principal(), StaffRoleIds.CaseSpecialist));
        Assert.Empty(ClaimsPermissionService.SubRolesFrom(
            Principal(new Claim(CaseSpecialistSubRoles.ClaimType, Study)),
            StaffRoleIds.SectionSupervisor));
    }

    [Fact]
    public void Staff_actor_comes_from_the_permissions()
    {
        var actor = StaffActor.From(new PermissionsDto
        {
            UserId = "u-1",
            PrototypeRole = " Case-Specialist ",
            SubRoles = [Review],
        });

        Assert.True(actor.IsCaseSpecialist);
        Assert.True(actor.HoldsReview);
        Assert.False(actor.HoldsStudy);
        Assert.False(StaffActor.From(null).IsCaseSpecialist);
    }

    // ---- who hears what (shared queues) ----

    [Theory]
    [InlineData(WorkflowTaskKind.FieldInspection, false, Coordination)]
    [InlineData(WorkflowTaskKind.EngineeringSurvey, false, Coordination)]
    [InlineData(WorkflowTaskKind.FieldInspection, true, Study)]
    [InlineData(WorkflowTaskKind.PropertyAppraisal, false, Study)]
    public void A_party_submit_reaches_the_sub_role_of_the_next_step(WorkflowTaskKind kind, bool received, string expected)
    {
        Assert.Equal(expected, CaseSpecialistAudience.OnPartySubmitted(kind, received));
    }

    [Fact]
    public void Valuation_notice_audiences_name_their_sub_role()
    {
        Assert.Equal(Review, ValuationNoticeAudiences.SubRoleOf(ValuationNoticeAudiences.CaseSpecialistReview));
        Assert.Equal(Study, ValuationNoticeAudiences.SubRoleOf(ValuationNoticeAudiences.CaseSpecialistStudy));
        Assert.Null(ValuationNoticeAudiences.SubRoleOf(ValuationNoticeAudiences.CaseSpecialist));
        Assert.Null(ValuationNoticeAudiences.SubRoleOf(ValuationNoticeAudiences.Appraiser));
        Assert.Equal(Coordination, CaseSpecialistAudience.Operations);
        Assert.Equal(Review, CaseSpecialistAudience.DraftApproval);
    }

    // ---- formal receipt (coordination → study) ----

    [Fact]
    public void The_receipt_waits_for_every_live_field_party_on_every_deed()
    {
        var deeds = new[] { "صك 1", "صك 2" };
        var parties = new List<ReceiptPartyFacts>
        {
            new("صك 1", WorkflowTaskKind.FieldInspection, WorkflowTaskStatus.Open, PartyTaskSubmissionStatus.Submitted),
            new("صك 1", WorkflowTaskKind.EngineeringSurvey, WorkflowTaskStatus.Open, PartyTaskSubmissionStatus.Draft),
            new("صك 1", WorkflowTaskKind.PropertyAppraisal, WorkflowTaskStatus.Open, null),
            new("صك 2", WorkflowTaskKind.FieldInspection, WorkflowTaskStatus.Open, PartyTaskSubmissionStatus.Reopened),
            new("صك 2", WorkflowTaskKind.EngineeringSurvey, WorkflowTaskStatus.Cancelled, null),
        };

        var missing = FormalReceiptRules.MissingAr(deeds, parties);

        Assert.Equal(3, missing.Count);
        Assert.Contains("صك 1: سلّم المعاين الميداني عمله ولم تستلمه بعد.", missing);
        Assert.Contains("صك 1: لم يسلّم المكتب الهندسي عمله بعد.", missing);
        Assert.Contains("صك 2: لم يسلّم المعاين الميداني عمله بعد.", missing);
    }

    [Fact]
    public void A_deed_without_an_inspection_cannot_be_received_and_a_complete_one_can()
    {
        Assert.Equal(
            ["لم تُوزَّع المعاينة الميدانية بعد."],
            FormalReceiptRules.MissingAr(["صك 1"], []));
        Assert.Empty(FormalReceiptRules.MissingAr(
            ["صك 1"],
            [new("صك 1", WorkflowTaskKind.FieldInspection, WorkflowTaskStatus.Completed, PartyTaskSubmissionStatus.Submitted, Accepted: true)]));
    }

    /// <summary>Omar 2026-11-08: external deliveries and linked tasks hold the send too.</summary>
    [Fact]
    public void The_send_waits_for_external_parties_and_linked_tasks()
    {
        var accepted = new ReceiptPartyFacts(
            "صك 1", WorkflowTaskKind.FieldInspection, WorkflowTaskStatus.Completed, PartyTaskSubmissionStatus.Submitted, Accepted: true);
        Assert.Equal(
            ["بانتظار طرف خارجي: مكتب الرواد — كروكي.", "مهمة مرتبطة لم تُقبل مخرجاتها: T-2026-0009 مراجعة البلدية."],
            FormalReceiptRules.MissingAr(["صك 1"], [accepted], ["مكتب الرواد — كروكي"], ["T-2026-0009 مراجعة البلدية"]));
    }

    [Fact]
    public void The_receipt_is_stamped_once_and_the_merge_follows_the_stage_owner()
    {
        var transaction = Transaction.CreateDraft("TMP-26-00009", DateTime.UtcNow);
        Assert.True(transaction.MarkReceived("u-1", " منسق ", DateTime.UtcNow));
        Assert.False(transaction.MarkReceived("u-2", "آخر", DateTime.UtcNow));
        Assert.Equal("منسق", transaction.ReceivedByName);

        var coordination = new StaffActor(StaffRoleIds.CaseSpecialist, [Coordination]);
        var study = new StaffActor(StaffRoleIds.CaseSpecialist, [Study]);
        Assert.True(PoRoleMatrixRules.CanMergeAtStage(coordination, transactionReceived: false));
        Assert.False(PoRoleMatrixRules.CanMergeAtStage(coordination, transactionReceived: true));
        Assert.True(PoRoleMatrixRules.CanMergeAtStage(study, transactionReceived: true));
        Assert.True(PoRoleMatrixRules.CanFormallyReceive(coordination));
        Assert.False(PoRoleMatrixRules.CanFormallyReceive(study));
    }
}
