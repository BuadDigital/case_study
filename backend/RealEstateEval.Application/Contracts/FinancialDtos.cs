namespace RealEstateEval.Application.Contracts;

public class FinancialSummaryDto
{
    public required string PeriodLabel { get; init; }
    public required string RevenueTotal { get; init; }
    public required string ExternalCostsTotal { get; init; }
    public required string ProfitMarginTotal { get; init; }
    public required string ProfitMarginPercentLabel { get; init; }
    public required string PendingPayablesTotal { get; init; }
    public IReadOnlyList<FinancialRevenueRowDto> RevenueRows { get; init; } = [];
    public IReadOnlyList<FinancialCostRowDto> CostRows { get; init; } = [];
    public required string RevenueGrandTotal { get; init; }
}

public class FinancialRevenueRowDto
{
    public required string Po { get; init; }
    public int Billed { get; init; }
    public int Excluded { get; init; }
    public required string Value { get; init; }
    public required string Status { get; init; }
}

public class FinancialCostRowDto
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public required string Cost { get; init; }
    public required string Category { get; init; }
}
