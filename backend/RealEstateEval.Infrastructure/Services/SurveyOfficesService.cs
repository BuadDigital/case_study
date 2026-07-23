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
