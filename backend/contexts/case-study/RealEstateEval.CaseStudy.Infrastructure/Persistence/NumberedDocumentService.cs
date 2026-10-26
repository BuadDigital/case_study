using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// Decision 25 + numbering workshop: a letter takes its LT number at print time. Decision
/// 2026-10-19: the case-study report's number is PRC-… derived from the transaction's official
/// reference, which is confirmed here if the report is the first approval. Both are logged as
/// immutable ledger rows; asking for the same report number twice returns the same row.
/// </summary>
public sealed class NumberedDocumentService : INumberedDocumentService
{
    private const int MaxListRows = 500;

    private readonly CaseStudyDbContext _caseStudy;
    private readonly TimeProvider _time;
    private readonly ITransactionReferenceService _transactions;

    [ActivatorUtilitiesConstructor]
    public NumberedDocumentService(
        CaseStudyDbContext caseStudy,
        TimeProvider? time = null,
        ITransactionReferenceService? transactions = null)
    {
        _time = time ?? TimeProvider.System;
        _caseStudy = caseStudy;
        _transactions = transactions ?? new TransactionReferenceService(new TransactionRepository(caseStudy));
    }

    /// <summary>Gives a printed document its reference number and logs it in the ledger.</summary>
    /// <remarks>
    /// How it works: 1) validates the kind; 2) case-study report: needs the property, confirms the
    /// transaction's PR reference (drawn now if this is the first approval), derives PRC-{YY}-{seq}
    /// from it and returns the existing ledger row when that number is already logged; 3) letter:
    /// draws the next yearly LT number; 4) writes a new immutable NumberedDocument row and returns it.
    /// Edge cases: a report request without a property, or a PR confirmation error, returns an Arabic
    /// error and logs nothing; asking twice for the same report returns the same row (before
    /// 2026-10-19 every request drew a fresh report number from its own counter).
    /// </remarks>
    public async Task<(NumberedDocumentDto? Result, string? Error)> AllocateAsync(
        AllocateNumberedDocumentRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var kind = (request.Kind ?? "").Trim().ToLowerInvariant();
        if (!NumberedDocumentKinds.IsValid(kind))
            return (null, "نوع المستند المرقّم غير مدعوم.");

        var now = _time.UtcNow();
        string reference;
        if (kind == NumberedDocumentKinds.CaseStudyReport)
        {
            if (request.PropertyId is not Guid propertyId)
                return (null, "رقم تقرير دراسة الحالة يحتاج العقار.");

            var (root, confirmError) = await _transactions.ConfirmOfficialReferenceAsync(propertyId, now, cancellationToken);
            if (confirmError is not null || string.IsNullOrWhiteSpace(root))
                return (null, confirmError ?? "تعذّر تثبيت الرقم المرجعي.");
            reference = ReferenceNumbering.CaseStudyReportNumber(root)!;

            var existing = await _caseStudy.NumberedDocuments.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ReferenceNumber == reference, cancellationToken);
            if (existing is not null) return (ToDto(existing), null);
        }
        else
        {
            var (allocated, error) = await ReferenceSequenceAllocator.AllocateYearlyAsync(
                _caseStudy,
                DatabaseSchemas.CaseStudy,
                ReferenceNumbering.Letter,
                now,
                cancellationToken);
            if (error is not null) return (null, error);
            reference = allocated!;
        }

        var entity = new NumberedDocument
        {
            Id = Guid.NewGuid(),
            Kind = kind,
            ReferenceNumber = reference,
            PoNumber = request.PoNumber?.Trim() ?? "",
            PropertyId = request.PropertyId,
            Title = request.Title?.Trim() ?? "",
            CreatedByUserId = actorUserId,
            CreatedAtUtc = now,
        };
        _caseStudy.NumberedDocuments.Add(entity);
        await _caseStudy.SaveChangesAsync(cancellationToken);

        return (ToDto(entity), null);
    }

    public async Task<IReadOnlyList<NumberedDocumentDto>> ListAsync(
        string? kind,
        string? poNumber,
        CancellationToken cancellationToken = default)
    {
        var query = _caseStudy.NumberedDocuments.AsNoTracking().AsQueryable();

        var normalizedKind = kind?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(normalizedKind))
            query = query.Where(x => x.Kind == normalizedKind);

        var normalizedPo = poNumber?.Trim();
        if (!string.IsNullOrEmpty(normalizedPo))
            query = query.Where(x => x.PoNumber == normalizedPo);

        var rows = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    private static NumberedDocumentDto ToDto(NumberedDocument entity) => new()
    {
        Id = entity.Id,
        Kind = entity.Kind,
        ReferenceNumber = entity.ReferenceNumber,
        PoNumber = entity.PoNumber,
        PropertyId = entity.PropertyId,
        Title = entity.Title,
        CreatedAtUtc = entity.CreatedAtUtc,
    };
}
