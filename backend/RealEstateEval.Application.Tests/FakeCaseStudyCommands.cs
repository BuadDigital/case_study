using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Stands in for the Case Study owner call that confirms the transaction's PR reference
///Hands back a fixed root so the report number is PRV-2026-00001.
/// </summary>
public sealed class FakeCaseStudyCommands : ICaseStudyCommands
{
    public const string Reference = "PR-2026-00001";

    public int ConfirmCalls { get; private set; }

    public string? FailWith { get; set; }

    public Task<(string? Reference, string? Error)> AllocateDocumentReferenceAsync(
        string dept,
        string type,
        string dateKey,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<(string?, string?)>(($"{dept}-{type}-{dateKey}-001", null));

    public Task BackfillPropertyAreaIfEmptyAsync(
        Guid propertyId,
        decimal areaM2,
        CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<(CaseStudyTransactionNumbersDto? Result, string? Error)> ConfirmTransactionReferenceAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        ConfirmCalls++;
        if (FailWith is not null)
            return Task.FromResult<(CaseStudyTransactionNumbersDto?, string?)>((null, FailWith));
        return Task.FromResult<(CaseStudyTransactionNumbersDto?, string?)>((new CaseStudyTransactionNumbersDto
        {
            TransactionId = Guid.NewGuid(),
            ReferenceNumber = Reference,
            CaseStudyReportNumber = "PRC-2026-00001",
            ValuationReportNumber = "PRV-2026-00001",
        }, null));
    }
}
