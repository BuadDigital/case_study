using System.Text.Json;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public sealed class FieldInspectionAttachmentVerifier : IFieldInspectionAttachmentVerifier
{
    private readonly IAttachmentLookup _lookup;

    public FieldInspectionAttachmentVerifier(IAttachmentLookup lookup)
    {
        _lookup = lookup;
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
        var rows = (await _lookup.GetRefsAsync(ids, cancellationToken))
            .ToDictionary(x => x.Id);

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
