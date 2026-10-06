using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed partial class ValuationReportIssuanceService
{
    public const string DepositRecordedCannotWithdrawAr =
        "سُجِّل رمز الإيداع — التعديل بعده يكون بنسخة جديدة ";

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
        db.ValuationReportIssuances.Remove(row);
        await db.SaveChangesAsync(cancellationToken);

        if (audit is not null && auditLog is not null)
        {
            await auditLog.AppendAsync(audit.Create(
                actorId: string.IsNullOrWhiteSpace(requestedByUserId) ? "unknown" : requestedByUserId,
                action: "valuation.report-issuance.approval-withdrawn",
                entityType: "ValuationReportIssuance",
                entityId: valuationRequestId.ToString("D"),
                before: new { version, stage = "deposit_issued" },
                after: new { version, stage = "draft" }),
                cancellationToken);
        }

        return (true, null);
    }
}
