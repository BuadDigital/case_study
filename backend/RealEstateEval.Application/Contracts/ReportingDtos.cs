namespace RealEstateEval.Application.Contracts;

public class ReportingDashboardDto
{
    public IReadOnlyList<ValuationRequestDto> RecentValuationRequests { get; init; } = [];
    public IReadOnlyList<ReportingTeamMemberDto> TeamFieldMembers { get; init; } = [];
    public IReadOnlyList<ReportingSpecialistLoadDto> SpecialistLoad { get; init; } = [];
    public FieldInspectionWorkspaceSummaryDto? FieldInspectionProgress { get; init; }
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
