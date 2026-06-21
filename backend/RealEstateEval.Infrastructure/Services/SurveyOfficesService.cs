using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class SurveyOfficesService : ISurveyOfficesService
{
    private readonly ApplicationDbContext _db;
    private readonly ApiResponseCache _cache;

    public SurveyOfficesService(ApplicationDbContext db, ApiResponseCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<IReadOnlyList<SurveyOfficeDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        return await _cache.GetOrCreateAsync(
            CacheKeys.SurveyOfficesList,
            CacheDurations.SurveyOffices,
            async ct =>
            {
                var rows = await _db.SurveyOffices.AsNoTracking()
                    .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
                    .ToListAsync(ct);
                return (IReadOnlyList<SurveyOfficeDto>)rows.Select(ToDto).ToList();
            },
            cancellationToken);
    }

    public async Task<SurveyOfficeDto?> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var row = await _db.SurveyOffices.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return row is null ? null : ToDto(row);
    }

    public async Task<SurveyOfficeDto> CreateAsync(
        SaveSurveyOfficeRequest request,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var row = new SurveyOffice
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            ActiveCount = request.Active,
            DoneMonth = request.DoneMonth,
            AvgDaysLabel = request.AvgDays.Trim(),
            ContractLabel = request.Contract.Trim(),
            StatusBusy = request.StatusBusy,
            SortOrder = request.SortOrder,
            UpdatedAtUtc = now,
        };
        _db.SurveyOffices.Add(row);
        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.SurveyOfficesList, cancellationToken);
        return ToDto(row);
    }

    public async Task<SurveyOfficeDto?> UpdateAsync(
        Guid id,
        SaveSurveyOfficeRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.SurveyOffices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return null;

        row.Name = request.Name.Trim();
        row.ActiveCount = request.Active;
        row.DoneMonth = request.DoneMonth;
        row.AvgDaysLabel = request.AvgDays.Trim();
        row.ContractLabel = request.Contract.Trim();
        row.StatusBusy = request.StatusBusy;
        if (request.SortOrder > 0) row.SortOrder = request.SortOrder;
        row.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.SurveyOfficesList, cancellationToken);
        return ToDto(row);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var row = await _db.SurveyOffices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return false;

        _db.SurveyOffices.Remove(row);
        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.SurveyOfficesList, cancellationToken);
        return true;
    }

    private static SurveyOfficeDto ToDto(SurveyOffice row) => new()
    {
        Id = row.Id,
        Name = row.Name,
        Active = row.ActiveCount,
        DoneMonth = row.DoneMonth,
        AvgDays = row.AvgDaysLabel,
        Contract = row.ContractLabel,
        StatusBusy = row.StatusBusy,
        SortOrder = row.SortOrder,
    };
}
