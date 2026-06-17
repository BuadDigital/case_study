using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/case-study-info-roles")]
[Authorize]
public class CaseStudyInfoRolesController : ControllerBase
{
    private static readonly Guid SingletonId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    private static readonly HashSet<string> ValidPartyIds =
    [
        "specA", "insp", "gov", "val", "eng", "sup",
    ];

    private static readonly HashSet<string> ValidRoleTypes =
    [
        "primary", "secondary", "verify", "none",
    ];

    private readonly ApplicationDbContext _db;
    public CaseStudyInfoRolesController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<CaseStudyInfoRolesConfigDto>> Get(
        CancellationToken cancellationToken)
    {
        var row = await _db.CaseStudyInfoRolesConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
            return Ok(EmptyDto());

        return Ok(ToDto(row));
    }

    [HttpPut]
    public async Task<ActionResult<CaseStudyInfoRolesConfigDto>> Save(
        [FromBody] SaveCaseStudyInfoRolesRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Matrix is null)
            return BadRequest(new { error = "matrix is required" });

        var sanitizedMatrix = SanitizeMatrix(request.Matrix);
        var notes = request.Notes ?? new Dictionary<string, string>();

        var row = await _db.CaseStudyInfoRolesConfigs
            .FirstOrDefaultAsync(cancellationToken);

        var now = DateTime.UtcNow;
        if (row is null)
        {
            row = new CaseStudyInfoRolesConfig
            {
                Id = SingletonId,
                MatrixJson = JsonSerializer.Serialize(sanitizedMatrix),
                NotesJson = JsonSerializer.Serialize(notes),
                UpdatedAtUtc = now,
            };
            _db.CaseStudyInfoRolesConfigs.Add(row);
        }
        else
        {
            row.MatrixJson = JsonSerializer.Serialize(sanitizedMatrix);
            row.NotesJson = JsonSerializer.Serialize(notes);
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(row));
    }

    private static Dictionary<string, Dictionary<string, string>> SanitizeMatrix(
        Dictionary<string, Dictionary<string, string?>> matrix)
    {
        var result = new Dictionary<string, Dictionary<string, string>>();

        foreach (var (questionKey, parties) in matrix)
        {
            if (string.IsNullOrWhiteSpace(questionKey) || parties is null)
                continue;

            var row = new Dictionary<string, string>();
            foreach (var (partyId, role) in parties)
            {
                if (!ValidPartyIds.Contains(partyId))
                    continue;
                if (string.IsNullOrWhiteSpace(role) || !ValidRoleTypes.Contains(role))
                    continue;
                if (role == "none")
                    continue;
                row[partyId] = role;
            }

            result[questionKey] = row;
        }

        return result;
    }

    private static CaseStudyInfoRolesConfigDto ToDto(CaseStudyInfoRolesConfig row)
    {
        var matrix = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(
                         row.MatrixJson)
                     ?? new Dictionary<string, Dictionary<string, string>>();
        var notes = JsonSerializer.Deserialize<Dictionary<string, string>>(row.NotesJson)
                    ?? new Dictionary<string, string>();
        return new CaseStudyInfoRolesConfigDto
        {
            Matrix = matrix,
            Notes = notes,
            UpdatedAt = row.UpdatedAtUtc,
        };
    }

    private static CaseStudyInfoRolesConfigDto EmptyDto() => new()
    {
        Matrix = new Dictionary<string, Dictionary<string, string>>(),
        Notes = new Dictionary<string, string>(),
        UpdatedAt = DateTime.UtcNow,
    };
}