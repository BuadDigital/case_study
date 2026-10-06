using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Rules;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed partial class ValuationReportDraftService
{
    public const string DepositForbiddenAr = "تسجيل رمز الإيداع للمقيّم المُسنَد للعقار فقط";
    public const string ReopenForbiddenAr = "إعادة فتح التقرير بنسخة جديدة للأخصائي فقط";
    public const string NotApprovedYetAr = "اعتمد التقرير أولاً ثم سجّل رمز الإيداع";
    public const string NoDepositedRequestAr = "لا تقرير مودَع لهذا العقار لفتحه بنسخة جديدة";

    public async Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)> RecordDepositAsync(
        Guid valuationRequestId,
        RegisterDepositCertificateRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (null, Error("طلب التقييم غير موجود"));
        if (!await IsAssignedAppraiserAsync(vr.PropertyId, actor, cancellationToken))
            return (null, Forbidden(DepositForbiddenAr));

        // The deposit code is recorded for the approved report only (the copy is frozen at approval).
        var draft = await CurrentDraftAsync(valuationRequestId, tracked: false, cancellationToken);
        if (draft is null || !draft.IsApproved)
            return (null, Error(NotApprovedYetAr));

        var (result, errors) = await issuance.RegisterCertificateAsync(valuationRequestId, request, actor.UserId, cancellationToken);
        if (errors is not null || finalReports is null) return (result, errors);

        // The final PDF (report + the code + the certificate page) is made now, and again after a code correction.
        // A renderer failure never undoes the registration: the status stays «preparing» and can be retried.
        await finalReports.EnsureGeneratedAsync(valuationRequestId, cancellationToken);
        return (await issuance.GetStateAsync(valuationRequestId, cancellationToken) ?? result, null);
    }

    public const string FinalReportForbiddenAr = "تقرير التقييم النهائي للأخصائي والإدارة والمقيّم المُسنَد للعقار";
    public const string FinalReportNotReadyAr = "ملف التقرير النهائي قيد الإعداد — أعد المحاولة بعد قليل";

    public async Task<(FinalReportFile? File, Dictionary<string, string>? Errors)> GetFinalReportAsync(
        Guid valuationRequestId,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        var (allowed, error) = await MayUseFinalReportAsync(valuationRequestId, actor, cancellationToken);
        if (!allowed) return (null, error);
        if (finalReports is null) return (null, Error(FinalReportNotReadyAr));

        var file = await finalReports.GetFileAsync(valuationRequestId, cancellationToken);
        return file is null ? (null, Error(FinalReportNotReadyAr)) : (file, null);
    }

    public async Task<(string? Status, Dictionary<string, string>? Errors)> RegenerateFinalReportAsync(
        Guid valuationRequestId,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        var (allowed, error) = await MayUseFinalReportAsync(valuationRequestId, actor, cancellationToken);
        if (!allowed) return (null, error);
        if (finalReports is null) return (FinalReportStatuses.Preparing, null);

        return (await finalReports.EnsureGeneratedAsync(valuationRequestId, cancellationToken), null);
    }

    private async Task<(bool Allowed, Dictionary<string, string>? Error)> MayUseFinalReportAsync(
        Guid valuationRequestId,
        ReportDraftActor actor,
        CancellationToken cancellationToken)
    {
        var vr = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (false, Error("طلب التقييم غير موجود"));

        var allowed = PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)
            || await IsAssignedAppraiserAsync(vr.PropertyId, actor, cancellationToken);
        return allowed ? (true, null) : (false, Forbidden(FinalReportForbiddenAr));
    }

    public async Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)> ReopenNewVersionAsync(
        Guid valuationRequestId,
        ReopenReportIssuanceRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanReopenValuationReport(actor.PrototypeRole))
            return (null, Forbidden(ReopenForbiddenAr));

        return await issuance.ReopenAfterDepositAsync(valuationRequestId, request, actor.UserId, cancellationToken);
    }

    public async Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)> ReopenNewVersionByPropertyAsync(
        Guid propertyId,
        ReopenReportIssuanceRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanReopenValuationReport(actor.PrototypeRole))
            return (null, Forbidden(ReopenForbiddenAr));

        // The property's request that holds the current deposit copy (the closed one after the final issuance).
        var requestId = await db.ValuationRequests.AsNoTracking()
            .Where(x => x.PropertyId == propertyId)
            .Where(x => db.ValuationReportIssuances.Any(i => i.ValuationRequestId == x.Id && i.SupersededAtUtc == null))
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (requestId is not { } id) return (null, Error(NoDepositedRequestAr));

        return await issuance.ReopenAfterDepositAsync(id, request, actor.UserId, cancellationToken);
    }
}
