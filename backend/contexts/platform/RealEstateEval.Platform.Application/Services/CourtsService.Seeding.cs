using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>
/// Execution-court seeding: every shipped court exists with its numbered circuits; circuits
/// seeded under the legacy naming are renumbered in place, admin-created rows are untouched.
/// </summary>
public sealed partial class CourtsService
{
    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        var courts = (await _repo.ListCourtsWithCircuitsAsync(cancellationToken)).ToList();
        var now = _time.UtcNow();

        foreach (var seed in CourtCatalogSeed.ExecutionCourts)
        {
            var court = courts.FirstOrDefault(c =>
                c.Name == seed.Name && c.City == seed.City);
            if (court is null)
            {
                court = new Court
                {
                    Id = Guid.NewGuid(),
                    Name = seed.Name,
                    Region = seed.Region,
                    City = seed.City,
                    IsActive = true,
                    CreatedBy = "system",
                    CreatedAtUtc = now,
                };
                courts.Add(court);
                await _repo.AddCourtAsync(court, cancellationToken);
            }

            for (var index = 0; index < CourtCatalogSeed.ExecutionCircuitNames.Count; index++)
            {
                var circuitNo = CourtCatalogSeed.CircuitNo(index);
                var circuitName = CourtCatalogSeed.ExecutionCircuitNames[index];
                var legacyName = CourtCatalogSeed.LegacyCircuitNo(circuitName);
                var circuit = court.Circuits.FirstOrDefault(c => c.CircuitNo == circuitNo);

                if (circuit is null)
                {
                    circuit = court.Circuits.FirstOrDefault(c =>
                        c.CreatedBy == "system" &&
                        (c.CircuitNo == legacyName || c.CircuitName == circuitName));
                }

                if (circuit is not null)
                {
                    if (circuit.CreatedBy == "system")
                    {
                        circuit.CircuitNo = circuitNo;
                        circuit.CircuitName = circuitName;
                    }
                    continue;
                }

                var newCircuit = new CourtCircuit
                {
                    Id = Guid.NewGuid(),
                    CourtId = court.Id,
                    CircuitNo = circuitNo,
                    CircuitName = circuitName,
                    IsActive = true,
                    CreatedBy = "system",
                    CreatedAtUtc = now,
                };
                court.Circuits.Add(newCircuit);
                await _repo.AddCircuitAsync(newCircuit, cancellationToken);
            }
        }

        if (_repo.HasPendingChanges())
        {
            await _repo.SaveChangesAsync(cancellationToken);
            await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        }
    }
}
