using System.Text.Json;
using System.Text.Json.Nodes;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Platform.Application.Rules;

/// <summary>
/// The certified valuer (المقيّم المعتمد) lives in one place: the active roster row whose
/// role is <c>certified</c>. The <c>evaluator</c> block the report and the issuance gate read
/// is derived from that row on every read and save, never edited on its own.
/// </summary>
public static class CertifiedValuerRules
{
    public const string CertifiedRole = "certified";

    public static bool IsCertified(OrganizationValuerRosterEntryDto row) =>
        string.Equals(row.Role, CertifiedRole, StringComparison.OrdinalIgnoreCase);

    public static OrganizationValuerRosterEntryDto? ActiveCertified(
        IEnumerable<OrganizationValuerRosterEntryDto> valuers) =>
        valuers.FirstOrDefault(v => v.IsActive && IsCertified(v));

    /// <summary>
    /// Title and the Hijri licence expiry have no roster column, so they carry over from the
    /// stored block. With no active certified row the identity is empty and issuance stops.
    /// </summary>
    public static OrganizationEvaluatorSettingsDto DeriveEvaluator(
        IEnumerable<OrganizationValuerRosterEntryDto> valuers,
        OrganizationEvaluatorSettingsDto? stored,
        OrganizationCompanySettingsDto company)
    {
        var keep = stored ?? new OrganizationEvaluatorSettingsDto();
        var row = ActiveCertified(valuers);
        if (row is null)
        {
            return new OrganizationEvaluatorSettingsDto
            {
                Title = keep.Title,
                LicenseExpiresHijri = keep.LicenseExpiresHijri,
            };
        }

        return new OrganizationEvaluatorSettingsDto
        {
            Name = row.NameAr,
            LicenseNumber = FirstFilled(row.LicenseNumber, company.PracticeLicenseNumber),
            MembershipNumber = row.MembershipNumber,
            MembershipCategory = row.MembershipCategory,
            LicenseExpiresAt = FirstFilled(row.LicenseExpiresAt, company.PracticeLicenseExpiresAt),
            MembershipExpiresAt = row.MembershipExpiresAt,
            LicenseIssuedAt = FirstFilled(row.LicenseIssuedAt, keep.LicenseIssuedAt),
            LicenseExpiresHijri = keep.LicenseExpiresHijri,
            Title = keep.Title,
        };
    }

    /// <summary>
    /// The report prints one signature: the certified valuer's. It is uploaded on their user
    /// card and mirrored onto branding here, so nothing else has to copy it.
    /// </summary>
    public static OrganizationBrandingSettingsDto MirrorCertifiedSignature(
        OrganizationBrandingSettingsDto branding,
        IEnumerable<OrganizationValuerRosterEntryDto> valuers,
        JsonSerializerOptions jsonOptions)
    {
        var signature = ActiveCertified(valuers)?.SignatureUrl?.Trim();
        if (string.IsNullOrWhiteSpace(signature) || signature == branding.SignatureUrl)
            return branding;
        var node = JsonSerializer.SerializeToNode(branding, jsonOptions) as JsonObject;
        if (node is null) return branding;
        var key = node.Select(p => p.Key).FirstOrDefault(k => string.Equals(k, "signatureUrl", StringComparison.OrdinalIgnoreCase)) ?? "signatureUrl";
        node[key] = signature;
        return node.Deserialize<OrganizationBrandingSettingsDto>(jsonOptions) ?? branding;
    }

    private static string? FirstFilled(string? first, string? second) =>
        string.IsNullOrWhiteSpace(first)
            ? (string.IsNullOrWhiteSpace(second) ? null : second.Trim())
            : first.Trim();
}
