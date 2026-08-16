namespace RealEstateEval.Domain;

/// <summary>
/// Dual license + membership gate for report issuance (§7 / decision 2.1).
/// Expired license or membership blocks issue; ≤60 days remaining is a warning.
/// </summary>
public static class ValuerCredentialRules
{
    public const int WarningDays = 60;

    public static bool TryParseDate(string? isoOrYmd, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(isoOrYmd)) return false;
        var s = isoOrYmd.Trim();
        if (DateOnly.TryParse(s, out date)) return true;
        if (DateTime.TryParse(s, out var dt))
        {
            date = DateOnly.FromDateTime(dt);
            return true;
        }
        return false;
    }

    public static bool IsExpired(string? expiresAt, DateOnly today) =>
        TryParseDate(expiresAt, out var d) && d < today;

    public static int? DaysUntilExpiry(string? expiresAt, DateOnly today)
    {
        if (!TryParseDate(expiresAt, out var d)) return null;
        return d.DayNumber - today.DayNumber;
    }

    public static bool IsWithinWarningWindow(string? expiresAt, DateOnly today)
    {
        var days = DaysUntilExpiry(expiresAt, today);
        return days is >= 0 and <= WarningDays;
    }

    /// <summary>Hard gate: both credentials must be present and not expired.</summary>
    public static bool AllowsIssuance(
        string? licenseExpiresAt,
        string? membershipExpiresAt,
        DateOnly today,
        out string? blockReason)
    {
        if (string.IsNullOrWhiteSpace(licenseExpiresAt))
        {
            blockReason = "تاريخ انتهاء ترخيص المزاولة غير مُدخل";
            return false;
        }

        if (string.IsNullOrWhiteSpace(membershipExpiresAt))
        {
            blockReason = "تاريخ انتهاء / سريان العضوية غير مُدخل";
            return false;
        }

        if (IsExpired(licenseExpiresAt, today))
        {
            blockReason = "ترخيص المزاولة منتهٍ — يُمنع إصدار التقرير";
            return false;
        }

        if (IsExpired(membershipExpiresAt, today))
        {
            blockReason = "العضوية منتهية — يُمنع إصدار التقرير";
            return false;
        }

        blockReason = null;
        return true;
    }
}
