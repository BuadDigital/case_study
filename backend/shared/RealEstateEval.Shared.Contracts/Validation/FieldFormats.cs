using System.Net.Mail;
using System.Text.RegularExpressions;

namespace RealEstateEval.Application.Validation;

/// <summary>
/// Shared request-shape helpers. Lives in Shared.Contracts (ADR 0002) so owner
/// validator assemblies do not pull the global Application assembly for IBAN/URL/email checks.
/// </summary>
public static class FieldFormats
{
    public static bool IsEmail(string value)
    {
        try
        {
            _ = new MailAddress(value);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static bool IsHttpUrl(string value) =>
        Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    public static bool IsSaudiIban(string value) =>
        Regex.IsMatch(value.Replace(" ", ""), @"^SA\d{22}$", RegexOptions.IgnoreCase);
}
