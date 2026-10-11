using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed class PropertyComparableLinkService(
    ValuationDbContext db,
    TimeProvider? time = null)
    : IPropertyComparableLinkService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<PropertyComparableLinkListDto> ListAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var rows = await db.PropertyComparableLinks.AsNoTracking()
            .Include(x => x.ComparableProperty)
            .Where(x => x.PropertyId == propertyId)
            .OrderBy(x => x.LinkedAtUtc)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(_time.UtcNow());
        var items = rows
            .Where(r => r.ComparableProperty is not null && r.ComparableProperty.IsActive)
            .Select(r => ToItem(r, today))
            .ToList();

        return BuildList(propertyId, items);
    }

    private static PropertyComparableLinkListDto BuildList(
        Guid propertyId,
        IReadOnlyList<PropertyComparableLinkItemDto> items)
    {
        var count = items.Count;
        return new PropertyComparableLinkListDto
        {
            PropertyId = propertyId,
            LinkedCount = count,
            Items = items,
        };
    }

    private static PropertyComparableLinkItemDto ToItem(PropertyComparableLink row, DateOnly today)
    {
        var comp = row.ComparableProperty!;
        var dto = ComparablePropertyMapping.ToDto(comp, today);
        var description = string.IsNullOrWhiteSpace(row.Description)
            ? dto.Description
            : row.Description;
        return new PropertyComparableLinkItemDto
        {
            LinkId = row.Id,
            PropertyId = row.PropertyId,
            ComparablePropertyId = row.ComparablePropertyId,
            Description = description,
            LinkedByUserId = row.LinkedByUserId,
            LinkedAtUtc = row.LinkedAtUtc.ToString("o"),
            Comparable = dto,
        };
    }
}
