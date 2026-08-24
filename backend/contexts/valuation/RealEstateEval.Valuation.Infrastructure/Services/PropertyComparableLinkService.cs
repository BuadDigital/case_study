using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PropertyComparableLinkService(ValuationDbContext db, TimeProvider? time = null)
    : IPropertyComparableLinkService, IPropertyComparableLinkLookup
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

    public async Task<(PropertyComparableLinkListDto? Result, Dictionary<string, string>? Errors)> LinkAsync(
        LinkPropertyComparableRequest request,
        string linkedByUserId,
        CancellationToken cancellationToken = default)
    {
        if (request.PropertyId == Guid.Empty)
        {
            return (null, new Dictionary<string, string> { ["propertyId"] = "معرّف العقار مطلوب" });
        }

        if (request.ComparablePropertyId == Guid.Empty)
        {
            return (null, new Dictionary<string, string> { ["comparablePropertyId"] = "معرّف المقارن مطلوب" });
        }

        var exists = await db.PropertyComparableLinks.AnyAsync(
            x => x.PropertyId == request.PropertyId
                && x.ComparablePropertyId == request.ComparablePropertyId,
            cancellationToken);
        if (exists)
            return (await ListAsync(request.PropertyId, cancellationToken), null);

        var comp = await db.ComparableProperties.AsNoTracking()
            .FirstOrDefaultAsync(
                c => c.Id == request.ComparablePropertyId && c.IsActive,
                cancellationToken);
        if (comp is null)
        {
            return (null, new Dictionary<string, string> { ["comparablePropertyId"] = "المقارن غير موجود أو معطّل" });
        }

        db.PropertyComparableLinks.Add(new PropertyComparableLink
        {
            Id = Guid.NewGuid(),
            PropertyId = request.PropertyId,
            ComparablePropertyId = request.ComparablePropertyId,
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim(),
            LinkedByUserId = string.IsNullOrWhiteSpace(linkedByUserId) ? null : linkedByUserId.Trim(),
            LinkedAtUtc = _time.UtcNow(),
        });
        await db.SaveChangesAsync(cancellationToken);
        return (await ListAsync(request.PropertyId, cancellationToken), null);
    }

    public async Task<(PropertyComparableLinkItemDto? Result, Dictionary<string, string>? Errors)> PatchDescriptionAsync(
        Guid propertyId,
        Guid comparablePropertyId,
        PatchPropertyComparableLinkRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await db.PropertyComparableLinks
            .Include(x => x.ComparableProperty)
            .FirstOrDefaultAsync(
                x => x.PropertyId == propertyId && x.ComparablePropertyId == comparablePropertyId,
                cancellationToken);
        if (row is null)
            return (null, new Dictionary<string, string> { ["_"] = "المقارن غير مربوط بهذا العقار" });

        row.Description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();
        await db.SaveChangesAsync(cancellationToken);
        return (ToItem(row, DateOnly.FromDateTime(_time.UtcNow())), null);
    }

    public async Task<(bool Ok, string? Error)> UnlinkAsync(
        Guid propertyId,
        Guid comparablePropertyId,
        CancellationToken cancellationToken = default)
    {
        var row = await db.PropertyComparableLinks.FirstOrDefaultAsync(
            x => x.PropertyId == propertyId && x.ComparablePropertyId == comparablePropertyId,
            cancellationToken);
        if (row is null) return (false, "المقارن غير مربوط بهذا العقار");
        db.PropertyComparableLinks.Remove(row);
        await db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public async Task<int> CountLinkedAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        return await db.PropertyComparableLinks.AsNoTracking()
            .Where(x => x.PropertyId == propertyId)
            .Join(
                db.ComparableProperties.AsNoTracking().Where(c => c.IsActive),
                link => link.ComparablePropertyId,
                comp => comp.Id,
                (link, _) => link.Id)
            .CountAsync(cancellationToken);
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
            MeetsMinimumForAppraisalPrep = PropertyComparableLinkRules.MeetsMinimum(count),
            MinimumRequired = PropertyComparableLinkRules.MinimumLinkedForAppraisalPrep,
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
