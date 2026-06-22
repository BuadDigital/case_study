using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/field-inspection-workspaces")]
[Authorize]
public class FieldInspectionWorkspacesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public FieldInspectionWorkspacesController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FieldInspectionWorkspaceListItemDto>>> List(
        [FromQuery] string? poNumber,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var query = _db.FieldInspectionWorkspaces.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(poNumber))
            query = query.Where(x => x.PoNumber == poNumber.Trim());

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status.Trim());

        var rows = await query
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Take(500)
            .Select(x => new FieldInspectionWorkspaceListItemDto
            {
                WorkflowTaskId = x.WorkflowTaskId.ToString(),
                PropertyId = x.PropertyId.HasValue ? x.PropertyId.Value.ToString() : null,
                PoNumber = x.PoNumber,
                InspectionDate = x.InspectionDate.HasValue
                    ? x.InspectionDate.Value.ToString("yyyy-MM-dd")
                    : null,
                InspectionTime = x.InspectionTime,
                Status = x.Status,
                RequiredPhotoSlots = x.RequiredPhotoSlots,
                CompletedPhotoSlots = x.CompletedPhotoSlots,
                PendingPhotoApprovals = x.PendingPhotoApprovals,
                ObservationCount = x.ObservationCount,
                AttachmentCount = x.AttachmentCount,
                SubmittedAtUtc = x.SubmittedAtUtc.HasValue
                    ? x.SubmittedAtUtc.Value.ToString("O")
                    : null,
                UpdatedAtUtc = x.UpdatedAtUtc.ToString("O"),
            })
            .ToListAsync(ct);

        return Ok(rows);
    }

    [HttpGet("summary")]
    public async Task<ActionResult<FieldInspectionWorkspaceSummaryDto>> Summary(CancellationToken ct)
    {
        var rows = await _db.FieldInspectionWorkspaces.AsNoTracking().ToListAsync(ct);

        return Ok(new FieldInspectionWorkspaceSummaryDto
        {
            Total = rows.Count,
            Draft = rows.Count(x => x.Status == PartyTaskSubmissionStatus.Draft),
            Reopened = rows.Count(x => x.Status == PartyTaskSubmissionStatus.Reopened),
            Submitted = rows.Count(x => x.Status == PartyTaskSubmissionStatus.Submitted),
            PhotosPendingApproval = rows.Sum(x => x.PendingPhotoApprovals),
            IncompleteRequiredPhotos = rows.Sum(x =>
                Math.Max(0, x.RequiredPhotoSlots - x.CompletedPhotoSlots)),
        });
    }
}
