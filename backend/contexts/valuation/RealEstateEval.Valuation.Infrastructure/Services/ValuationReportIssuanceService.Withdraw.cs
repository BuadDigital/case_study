using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed partial class ValuationReportIssuanceService
{
    public const string DepositRecordedCannotWithdrawAr =
        "سُجِّل رمز الإيداع — التعديل بعده يكون بنسخة جديدة ";

    /// <summary>The appraiser's approval is taken back before any deposit code: the deposit copy is lifted.</summary>
    /// <remarks>
    /// How it works: no current copy → ok (idempotent); a recorded code or final copy refuses; otherwise the
    /// copy row is removed and an audit entry names the withdrawn copy.
    /// Edge cases (2026-11-10): the row is still removed, not superseded — a superseded row keeps its cycle
    /// number, and the unique (ValuationRequestId, Version) index plus «a withdrawal spends no version»
    /// leave no room for the re-approved copy of the same cycle without a schema change. Until then the
    /// audit entry records which frozen copy was withdrawn (issued at / by, SHA-256 of its snapshot).
    /// </remarks>
    public async Task<(bool Ok, string? Error)> WithdrawDepositAsync(
        Guid valuationRequestId,
        string? requestedByUserId,
        CancellationToken cancellationToken = default)
    {
        var row = await db.ValuationReportIssuances
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);
        if (row is null)
            return (true, null);

        if (!string.IsNullOrWhiteSpace(row.DepositCode) || row.FinalIssuedAtUtc is not null)
            return (false, DepositRecordedCannotWithdrawAr);

        var version = row.Version;
        var withdrawnCopy = new
        {
            version,
            stage = "deposit_issued",
            issuedAtUtc = row.DepositIssuedAtUtc.ToString("o"),
            issuedByUserId = row.DepositIssuedByUserId,
            snapshotSha256 = Convert.ToHexString(
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes(row.DocumentJson))).ToLowerInvariant(),
        };
        db.ValuationReportIssuances.Remove(row);
        await db.SaveChangesAsync(cancellationToken);

        if (audit is not null && auditLog is not null)
        {
            await auditLog.AppendAsync(audit.Create(
                actorId: string.IsNullOrWhiteSpace(requestedByUserId) ? "unknown" : requestedByUserId,
                action: "valuation.report-issuance.approval-withdrawn",
                entityType: "ValuationReportIssuance",
                entityId: valuationRequestId.ToString("D"),
                before: withdrawnCopy,
                after: new { version, stage = "draft" }),
                cancellationToken);
        }

        return (true, null);
    }
}
