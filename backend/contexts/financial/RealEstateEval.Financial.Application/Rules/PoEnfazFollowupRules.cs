using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

internal static class PoEnfazFollowupRules
{
    internal static (string Key, string Label) ResolveAgingBucket(int ageDays) =>
        ageDays switch
        {
            <= 30 => ("0_30", "0–30 يوماً"),
            <= 60 => ("31_60", "31–60 يوماً"),
            <= 90 => ("61_90", "61–90 يوماً"),
            _ => ("90_plus", "أكثر من 90 يوماً"),
        };

    internal static EnfazFollowupDto ToFollowupDto(PoEnfazFollowup f) => new()
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

    internal static string NormalizeChannel(string? raw)
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

    internal static string ChannelLabel(string channel) => channel switch
    {
        PoEnfazFollowupChannel.Email => "بريد",
        PoEnfazFollowupChannel.Portal => "بوابة إنفاذ",
        PoEnfazFollowupChannel.Visit => "زيارة",
        PoEnfazFollowupChannel.Other => "أخرى",
        _ => "اتصال",
    };
}
