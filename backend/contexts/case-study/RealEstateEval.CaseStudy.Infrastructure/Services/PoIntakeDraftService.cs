using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PoIntakeDraftService : IPoIntakeDraftService
{
    private readonly CaseStudyDbContext _db;
    private readonly TimeProvider _time;

    public PoIntakeDraftService(CaseStudyDbContext db, TimeProvider? time = null)
    {
        _db = db;
        _time = time ?? TimeProvider.System;
    }

    public async Task<PoIntakeDraftDto?> GetForUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.PoIntakeDrafts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        return row is null ? null : Deserialize(row.DraftJson, row.UpdatedAtUtc);
    }

    public async Task<PoIntakeDraftDto> SaveForUserAsync(
        string userId,
        PoIntakeDraftDto request,
        CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(request);
        var row = await _db.PoIntakeDrafts
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        var now = _time.UtcNow();

        if (row is null)
        {
            row = new PoIntakeDraft
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                DraftJson = payload,
                UpdatedAtUtc = now,
            };
            _db.PoIntakeDrafts.Add(row);
        }
        else
        {
            row.DraftJson = payload;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Deserialize(row.DraftJson, row.UpdatedAtUtc);
    }

    public async Task DeleteForUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        await _db.PoIntakeDrafts
            .Where(x => x.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private static PoIntakeDraftDto Deserialize(string json, DateTime updatedAtUtc)
    {
        try
        {
            var dto = JsonSerializer.Deserialize<PoIntakeDraftDto>(json);
            if (dto is null)
                return EmptyDraft(updatedAtUtc);
            return new PoIntakeDraftDto
            {
                Step = dto.Step,
                PoNumber = dto.PoNumber ?? "",
                AssignmentType = dto.AssignmentType ?? "",
                PromulgationDate = dto.PromulgationDate ?? "",
                AssignmentSpecialist = dto.AssignmentSpecialist ?? "",
                AssignmentSpecialistEmail = dto.AssignmentSpecialistEmail ?? "",
                ExpectedPropertyCount = dto.ExpectedPropertyCount > 0
                    ? dto.ExpectedPropertyCount
                    : 1,
                PropertiesRegion = dto.PropertiesRegion ?? "",
                WorkOrderDescription = dto.WorkOrderDescription ?? "",
                UpdatedAtUtc = updatedAtUtc,
            };
        }
        catch
        {
            return EmptyDraft(updatedAtUtc);
        }
    }

    private static PoIntakeDraftDto EmptyDraft(DateTime updatedAtUtc) => new()
    {
        Step = 1,
        ExpectedPropertyCount = 1,
        UpdatedAtUtc = updatedAtUtc,
    };
}
