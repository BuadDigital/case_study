using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Attachments.Application.Rules;

/// <summary>The property-timeline milestones of a «مستند ذو قيمة»: uploaded, approved, rejected.</summary>
public static class ValuedDocumentTimelineRules
{
    public const string UploadedTitleAr = "رفع مستند ذي قيمة";
    public const string ApprovedTitleAr = "اعتماد مستند ذي قيمة";
    public const string RejectedTitleAr = "رفض مستند ذي قيمة";

    /// <summary>The «PO:propertyId» scope key the valued-document uploads carry; null when it is anything else.</summary>
    public static (string PoNumber, Guid PropertyId)? ParseScopeKey(string? scopeKey)
    {
        var key = scopeKey?.Trim() ?? "";
        var cut = key.LastIndexOf(':');
        if (cut <= 0 || cut == key.Length - 1) return null;
        var po = key[..cut].Trim();
        return Guid.TryParse(key[(cut + 1)..], out var property) && property != Guid.Empty && po.Length > 0
            ? (po, property)
            : null;
    }

    public static PropertyTimelineRecordRequest? Uploaded(
        string? scopeKey, Guid attachmentId, string documentName, DateTime at) =>
        Build(scopeKey, $"valued-doc:{attachmentId:D}:uploaded", UploadedTitleAr, documentName, PropertyTimelineTones.Done, at);

    public static PropertyTimelineRecordRequest? Reviewed(
        string? scopeKey, Guid attachmentId, bool approved, string documentName, string? note, DateTime at) =>
        Build(
            scopeKey,
            $"valued-doc:{attachmentId:D}:{(approved ? "approved" : "rejected")}:{at.Ticks}",
            approved ? ApprovedTitleAr : RejectedTitleAr,
            string.IsNullOrWhiteSpace(note) ? documentName : $"{documentName} — {note.Trim()}",
            approved ? PropertyTimelineTones.Done : PropertyTimelineTones.Warn,
            at);

    private static PropertyTimelineRecordRequest? Build(
        string? scopeKey, string eventKey, string title, string detail, string tone, DateTime at) =>
        ParseScopeKey(scopeKey) is { } target
            ? new PropertyTimelineRecordRequest(target.PoNumber, target.PropertyId, eventKey, title, detail, tone, at)
            : null;
}
