using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class InternalDelegationLettersService : IInternalDelegationLettersService
{
    private readonly ApplicationDbContext _db;

    public InternalDelegationLettersService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<InternalDelegationLetterDto>> GetForPoAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.InternalDelegationLetterSets.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PoNumber == poNumber.Trim(), cancellationToken);
        return row is null ? [] : Deserialize(row.LettersJson);
    }

    public async Task<IReadOnlyList<InternalDelegationLetterDto>> SaveAsync(
        SaveInternalDelegationLettersRequest request,
        CancellationToken cancellationToken = default)
    {
        var po = request.PoNumber.Trim();
        var payload = JsonSerializer.Serialize(request.Letters ?? []);
        var row = await _db.InternalDelegationLetterSets
            .FirstOrDefaultAsync(x => x.PoNumber == po, cancellationToken);
        var now = DateTime.UtcNow;

        if (row is null)
        {
            row = new InternalDelegationLetterSet
            {
                Id = Guid.NewGuid(),
                PoNumber = po,
                LettersJson = payload,
                UpdatedAtUtc = now,
            };
            _db.InternalDelegationLetterSets.Add(row);
        }
        else
        {
            row.LettersJson = payload;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Deserialize(row.LettersJson);
    }

    private static IReadOnlyList<InternalDelegationLetterDto> Deserialize(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<InternalDelegationLetterDto>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
