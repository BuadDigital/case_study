namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Dual license + membership gate for report issuance (/ ).
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

    /// <summary>
    /// True only for a readable date before today. An unreadable value is NOT expired here — the
    /// issuance gate (<see cref="AllowsIssuance"/>) refuses it separately as «غير مقروء».
    /// </summary>
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

    /// <summary>
    /// Firm practice-license date (بيانات المنشأة) is the issuance source;
    /// a personal date is only a fallback when the firm date is empty.
    /// </summary>
    public static string? FirstFilled(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
                return value.Trim();
        }

        return null;
    }

    public const string LicenseDateUnreadableAr =
        "تاريخ انتهاء ترخيص المزاولة غير مقروء — أدخله تاريخاً صحيحاً (yyyy-MM-dd)";

    public const string MembershipDateUnreadableAr =
        "تاريخ انتهاء / سريان العضوية غير مقروء — أدخله تاريخاً صحيحاً (yyyy-MM-dd)";

    /// <summary>Hard gate: both credentials must be present, readable dates and not expired.</summary>
    /// <remarks>
    /// How it works: blank → «غير مُدخل»; a value that is not a date → «غير مقروء»; a past date → expired.
    /// Edge cases + fixed 2026-11-10: an unreadable value («N/A», «-», free text) used to pass because
    /// <see cref="IsExpired"/> is false when the date cannot be parsed — now it blocks like a blank one.
    /// The participant gate prefixes the reason with the participant's name.
    /// </remarks>
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

        if (!TryParseDate(licenseExpiresAt, out _))
        {
            blockReason = LicenseDateUnreadableAr;
            return false;
        }

        if (!TryParseDate(membershipExpiresAt, out _))
        {
            blockReason = MembershipDateUnreadableAr;
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
