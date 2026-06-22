using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class FieldInspectionAttachmentVerifier : IFieldInspectionAttachmentVerifier
{
    private readonly ApplicationDbContext _db;

    public FieldInspectionAttachmentVerifier(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<Dictionary<string, string>> VerifyAsync(
        Guid workflowTaskId,
        JsonElement payload,
        CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string>();
        var refs = FieldInspectionPayloadAttachments.Collect(payload);
        if (refs.Count == 0)
            return errors;

        var ids = refs.Select(r => r.AttachmentId).Distinct().ToArray();
        var rows = await _db.FileAttachments.AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var taskPrefix = $"{workflowTaskId}:";
        foreach (var reference in refs)
        {
            if (!rows.TryGetValue(reference.AttachmentId, out var row))
            {
                errors["definedPhotos"] = "مرفق صورة غير موجود في قاعدة البيانات";
                return errors;
            }

            if (!string.Equals(row.Scope, FieldInspectionScopes.Photo, StringComparison.Ordinal))
            {
                errors["definedPhotos"] = "مرفق الصورة لا يخص المعاينة الميدانية";
                return errors;
            }

            var expectedScopeKey = $"{taskPrefix}{reference.PhotoRef}";
            if (!string.Equals(row.ScopeKey, expectedScopeKey, StringComparison.Ordinal))
            {
                errors["definedPhotos"] = "مرفق الصورة مرتبط بمهمة أو موضع آخر";
                return errors;
            }
        }

        return errors;
    }
}
