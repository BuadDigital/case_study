using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>Entity → DTO projections for the courts catalog.</summary>
public sealed partial class CourtsService
{
    private static CourtDto ToDto(Court c, int circuitsCount) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Region = c.Region,
        City = c.City,
        IsActive = c.IsActive,
        CircuitsCount = circuitsCount,
        CreatedBy = c.CreatedBy,
        CreatedAtUtc = c.CreatedAtUtc.ToString("o"),
        UpdatedBy = c.UpdatedBy,
        UpdatedAtUtc = c.UpdatedAtUtc?.ToString("o"),
    };

    private static CourtDetailDto ToDetail(Court c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Region = c.Region,
        City = c.City,
        IsActive = c.IsActive,
        CircuitsCount = c.Circuits.Count,
        CreatedBy = c.CreatedBy,
        CreatedAtUtc = c.CreatedAtUtc.ToString("o"),
        UpdatedBy = c.UpdatedBy,
        UpdatedAtUtc = c.UpdatedAtUtc?.ToString("o"),
        Circuits = c.Circuits
            .OrderBy(x => x.CircuitNo)
            .Select(ToCircuitDto)
            .ToList(),
    };

    private static CourtCircuitDto ToCircuitDto(CourtCircuit c) => new()
    {
        Id = c.Id,
        CourtId = c.CourtId,
        CircuitNo = c.CircuitNo,
        CircuitName = c.CircuitName,
        IsActive = c.IsActive,
        CreatedBy = c.CreatedBy,
        CreatedAtUtc = c.CreatedAtUtc.ToString("o"),
        UpdatedBy = c.UpdatedBy,
        UpdatedAtUtc = c.UpdatedAtUtc?.ToString("o"),
    };

    private static SelectableCourtDto ToSelectable(Court c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Region = c.Region,
        City = c.City,
    };

    private static SelectableCircuitDto ToSelectable(CourtCircuit c) => new()
    {
        Id = c.Id,
        CourtId = c.CourtId,
        CircuitNo = c.CircuitNo,
        CircuitName = c.CircuitName,
    };
}
