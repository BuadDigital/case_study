using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// قرار 25 + ورشة الترقيم: الخطاب/تقرير دراسة الحالة يأخذ رقمه المرجعي لحظة
/// الطباعة ويُقيَّد في السجل — القيد لا يُعدَّل ولا يُحذف (سجل مرجعي).
/// </summary>
public sealed class NumberedDocumentService : INumberedDocumentService
{
    private const int MaxListRows = 500;

    private readonly ICaseStudyRepository _caseStudy;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public NumberedDocumentService(ICaseStudyRepository caseStudy, TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _caseStudy = caseStudy;
    }


    public async Task<(NumberedDocumentDto? Result, string? Error)> AllocateAsync(
        AllocateNumberedDocumentRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var kind = (request.Kind ?? "").Trim().ToLowerInvariant();
        if (!NumberedDocumentKinds.IsValid(kind))
            return (null, "نوع المستند المرقّم غير مدعوم.");

        var prefix = kind == NumberedDocumentKinds.Letter
            ? ReferenceNumbering.Letter
            : ReferenceNumbering.CaseStudyReport;

        var now = _time.UtcNow();
        var (reference, error) = await ReferenceSequenceAllocator.AllocateYearlyAsync(
            _caseStudy.Database,
            _caseStudy.ReferenceSequences,
            _caseStudy.SaveChangesAsync,
            DatabaseSchemas.CaseStudy,
            prefix,
            now,
            cancellationToken);
        if (error is not null) return (null, error);

        var entity = new NumberedDocument
        {
            Id = Guid.NewGuid(),
            Kind = kind,
            ReferenceNumber = reference!,
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
