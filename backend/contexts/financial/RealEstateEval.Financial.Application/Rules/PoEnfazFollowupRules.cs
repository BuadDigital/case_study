using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Follow-up and aging decisions of Enfaz receivables: the age buckets, the follow-up channel
/// vocabulary, and what a recorded follow-up looks like. Pure — the service saves.
/// </summary>
public static class PoEnfazFollowupRules
{
    public const int MaxNotesLength = 2000;

    public static (string Key, string Label) ResolveAgingBucket(int ageDays) =>
        ageDays switch
        {
            <= 30 => ("0_30", "0–30 يوماً"),
            <= 60 => ("31_60", "31–60 يوماً"),
            <= 90 => ("61_90", "61–90 يوماً"),
            _ => ("90_plus", "أكثر من 90 يوماً"),
        };

    public static EnfazFollowupDto ToFollowupDto(PoEnfazFollowup f) => new()
    {
        Id = f.Id,
        PoNumber = f.PoNumber,
        FollowedAtUtc = f.FollowedAtUtc,
        Channel = f.Channel,
        ChannelLabel = ChannelLabel(f.Channel),
        Notes = f.Notes,
        CreatedByUserId = f.CreatedByUserId,
        CreatedAtUtc = f.CreatedAtUtc,
    };

    public static string NormalizeChannel(string? raw)
    {
        var c = (raw ?? "").Trim().ToLowerInvariant();
        return c switch
        {
            PoEnfazFollowupChannel.Email => PoEnfazFollowupChannel.Email,
            PoEnfazFollowupChannel.Portal => PoEnfazFollowupChannel.Portal,
            PoEnfazFollowupChannel.Visit => PoEnfazFollowupChannel.Visit,
            PoEnfazFollowupChannel.Other => PoEnfazFollowupChannel.Other,
            _ => PoEnfazFollowupChannel.Call,
        };
    }

    public static string ChannelLabel(string channel) => channel switch
    {
        PoEnfazFollowupChannel.Email => "بريد",
        PoEnfazFollowupChannel.Portal => "بوابة إنفاذ",
        PoEnfazFollowupChannel.Visit => "زيارة",
        PoEnfazFollowupChannel.Other => "أخرى",
        _ => "اتصال",
    };

    /// <summary>A follow-up needs a PO and a note; null when both are present.</summary>
    public static string? ValidateFollowupInput(string trimmedPoNumber, string trimmedNotes)
    {
        if (string.IsNullOrEmpty(trimmedPoNumber))
            return "رقم أمر العمل مطلوب.";
        return string.IsNullOrEmpty(trimmedNotes) ? "ملاحظات المتابعة إلزامية." : null;
    }

    /// <summary>The follow-up row: channel normalised, notes capped, dated now unless the caller said when.</summary>
    public static PoEnfazFollowup BuildFollowup(
        string trimmedPoNumber,
        string trimmedNotes,
        AddEnfazFollowupRequest request,
        string actorUserId,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            PoNumber = trimmedPoNumber,
            FollowedAtUtc = request.FollowedAtUtc?.ToUniversalTime() ?? nowUtc,
            Channel = NormalizeChannel(request.Channel),
            Notes = trimmedNotes.Length > MaxNotesLength ? trimmedNotes[..MaxNotesLength] : trimmedNotes,
            CreatedByUserId = actorUserId ?? "",
            CreatedAtUtc = nowUtc,
        };
}
