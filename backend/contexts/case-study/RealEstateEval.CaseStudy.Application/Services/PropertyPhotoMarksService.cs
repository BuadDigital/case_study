using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>Saves the specialist's marks on the inspector's photos (2026-11-01 ruling).</summary>
public sealed class PropertyPhotoMarksService(
    IPropertyPhotoMarksRepository db,
    IAuditLogWriter audit,
    IAuditLogAppend auditLog) : IPropertyPhotoMarksService
{
    /// <summary>
    /// Replaces the property's marks.
    /// How it works: the whole set is sent on every change; a real change is stored and audited.
    /// Edge cases: an issued study refuses the save, so the appraiser works from a fixed set of photos
    /// — reopening the report opens the marks again. Saving the same marks writes nothing.
    /// </summary>
    public async Task<(PropertyPhotoMarksDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        string poNumber,
        Guid propertyId,
        PropertyPhotoMarksDto request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        var errors = PropertyPhotoMarksRules.Validate(request);
        if (errors.Count > 0) return (null, errors);

        var property = await db.GetPropertyAsync(poNumber, propertyId, cancellationToken);
        if (property is null)
            return (null, new Dictionary<string, string> { ["_"] = "العقار غير موجود" });

        if (await db.IsStudyReportIssuedAsync(propertyId, cancellationToken))
            return (null, new Dictionary<string, string> { ["_"] = CaseStudyReportService.ReportIssuedReopenFirstAr });

        var next = PropertyPhotoMarksRules.Serialize(request);
        if (next == property.PhotoMarksJson) return (PropertyPhotoMarksRules.Parse(next), null);

        var before = PropertyPhotoMarksRules.Parse(property.PhotoMarksJson);
        property.PhotoMarksJson = next;
        var after = PropertyPhotoMarksRules.Parse(next);
        await auditLog.AppendAsync(audit.Create(
            actorId: string.IsNullOrWhiteSpace(actor.UserId) ? "unknown" : actor.UserId,
            action: "case-study.property.photo-marks-saved",
            entityType: "WorkOrderProperty",
            entityId: propertyId.ToString("D"),
            before: before,
            after: after),
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (after, null);
    }
}
