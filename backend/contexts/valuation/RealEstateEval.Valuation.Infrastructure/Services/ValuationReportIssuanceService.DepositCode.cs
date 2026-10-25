using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>D15: one deposit code per current report, and parallel registrations — one wins, the others 409.</summary>
public sealed partial class ValuationReportIssuanceService
{
    /// <summary>
    /// D15: the code (compared case/space-insensitively, Latin digits) is held by another current report, or by
    /// any earlier version of this request — a new version gets its own certificate from the platform.
    /// Rows recorded before the comparison key existed are matched on their stored code.
    /// </summary>
    private async Task<bool> DepositCodeTakenAsync(
        ValuationReportIssuance row,
        string depositCode,
        CancellationToken cancellationToken)
    {
        var key = ValuationReportIssuance.DepositCodeKeyOf(depositCode);
        var legacy = ValuationReportIssuance.NormalizeDepositCode(depositCode).ToUpperInvariant();
        return await db.ValuationReportIssuances.AsNoTracking()
            .Where(x => x.Id != row.Id)
            .Where(x => x.SupersededAtUtc == null || x.ValuationRequestId == row.ValuationRequestId)
            .AnyAsync(
                x => x.DepositCodeKey == key
                     || (x.DepositCodeKey == null && x.DepositCode != null && x.DepositCode.Trim().ToUpper() == legacy),
                cancellationToken);
    }

    /// <summary>Saves the registration; a lost race (row version or the unique code index) comes back as a conflict.</summary>
    private async Task<Dictionary<string, string>?> SaveRegistrationAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("_", DepositCertificateRules.ConcurrentRegistrationAr);
        }
        catch (DbUpdateException ex) when (PostgresErrors.IsUniqueViolation(ex, ValuationReportIssuance.DepositCodeKeyCurrentIndex))
        {
            return Conflict("depositCode", DepositCertificateRules.DuplicateCodeAr);
        }
    }

    private static Dictionary<string, string> Conflict(string key, string message) =>
        new() { [key] = message, [DepositCertificateRules.ConflictKey] = "1" };
}
