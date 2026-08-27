using System.Text.Json;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Application;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed class PoIntakeDraftService(
    IPoIntakeDraftRepository drafts,
    TimeProvider? time = null) : IPoIntakeDraftService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<PoIntakeDraftDto> GetForUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var row = await drafts.GetByUserIdAsync(userId, track: false, cancellationToken);
        return row is null ? EmptyDraft() : Deserialize(row.DraftJson, row.UpdatedAtUtc);
    }

    public async Task<PoIntakeDraftDto> SaveForUserAsync(
        string userId,
        PoIntakeDraftDto request,
        CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(request);
        var row = await drafts.GetByUserIdAsync(userId, track: true, cancellationToken);
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
            drafts.Add(row);
        }
        else
        {
            row.DraftJson = payload;
            row.UpdatedAtUtc = now;
        }

        await drafts.SaveChangesAsync(cancellationToken);
        return Deserialize(row.DraftJson, row.UpdatedAtUtc);
    }

    public Task DeleteForUserAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        drafts.DeleteByUserIdAsync(userId, cancellationToken);

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

    private static PoIntakeDraftDto EmptyDraft(DateTime? updatedAtUtc = null) => new()
    {
        Step = 1,
        ExpectedPropertyCount = 1,
        UpdatedAtUtc = updatedAtUtc,
    };
}
