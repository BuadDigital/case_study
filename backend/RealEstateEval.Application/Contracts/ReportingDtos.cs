namespace RealEstateEval.Application.Contracts;

public class ReportingDashboardDto
{
    public IReadOnlyList<ValuationRequestDto> RecentValuationRequests { get; init; } = [];
    public IReadOnlyList<ReportingGovernmentReviewRowDto> RecentGovernmentReviews { get; init; } = [];
    public IReadOnlyList<ReportingFailureRowDto> RecentFailures { get; init; } = [];
    public ReportingPartyFeesOverviewDto? PartyFeesOverview { get; init; }
    public IReadOnlyList<ReportingTeamMemberDto> TeamFieldMembers { get; init; } = [];
    public IReadOnlyList<ReportingSpecialistLoadDto> SpecialistLoad { get; init; } = [];
    public FieldInspectionWorkspaceSummaryDto? FieldInspectionProgress { get; init; }
}

public class ReportingGovernmentReviewRowDto
{
    public required string TaskId { get; init; }
    public required string PoNumber { get; init; }
    public required string Title { get; init; }
    public required string ReviewerName { get; init; }
    public required string Status { get; init; }
}

public class ReportingFailureRowDto
{
    public required string Id { get; init; }
    public required string PoNumber { get; init; }
    public required string DeedNumber { get; init; }
    public required string Title { get; init; }
    public required string Status { get; init; }
    public required string Severity { get; init; }
    public required string UpdatedAt { get; init; }
}

public class ReportingPartyFeesOverviewDto
{
    public int PendingSupervisorReview { get; init; }
    public int AtFinance { get; init; }
    public int DisbursementRequested { get; init; }
    public decimal NetDraftSar { get; init; }
    public decimal SupReviewSar { get; init; }
    public decimal AtFinanceSar { get; init; }
    public decimal DisbReqSar { get; init; }
    public IReadOnlyList<ReportingPartyFeeRowDto> RecentRows { get; init; } = [];
}

public class ReportingPartyFeeRowDto
{
    public required string PoNumber { get; init; }
    public required string PropertyLabel { get; init; }
    public required string PartyKindLabel { get; init; }
    public required string BillingStatus { get; init; }
    public required string BillingStatusLabel { get; init; }
    public decimal NetFeeSar { get; init; }
}

public class ReportingTeamMemberDto
{
    public required string Initials { get; init; }
    public required string Name { get; init; }
    public required string RoleLine { get; init; }
    public required string TeamKind { get; init; }
    public int ActiveCount { get; init; }
}

public class ReportingSpecialistLoadDto
{
    public required string RoleId { get; init; }
    public required string Name { get; init; }
    public required string RoleLabel { get; init; }
    public int CurrentLoad { get; init; }
    public int MaxLoad { get; init; }
    public required string Tone { get; init; }
}

public class ReportingKpiDto
{
    public int OnTimeCompletionRate { get; init; }
    public required string AvgPropertyDaysLabel { get; init; }
    public double FailureRatePercent { get; init; }
    public int CompletedToday { get; init; }
    public IReadOnlyList<ReportingKpiScoreDto> SpecialistScores { get; init; } = [];
    public IReadOnlyList<ReportingKpiScoreDto> ProviderScores { get; init; } = [];
}

public class ReportingKpiScoreDto
{
    public required string Name { get; init; }
    public int ScorePercent { get; init; }
}
