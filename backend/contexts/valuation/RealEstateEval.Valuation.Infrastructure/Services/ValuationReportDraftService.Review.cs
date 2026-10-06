using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed partial class ValuationReportDraftService
{
    private const string PackageStatusUnknown = "unknown";

    public async Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> ApproveAsync(
        Guid valuationRequestId,
        ApproveReportDraftRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (null, Error("طلب التقييم غير موجود"));
        if (!await IsAssignedAppraiserAsync(vr.PropertyId, actor, cancellationToken))
            return (null, Forbidden(ReviewForbiddenAr));

        var draft = await CurrentDraftAsync(valuationRequestId, tracked: true, cancellationToken);
        if (draft is { IsApproved: true })
            return (await GetAsync(valuationRequestId, cancellationToken), null);
        if (draft is null || !draft.IsSent)
            return (null, Error(ValuationReportDraft.NotSentAr));

        var html = request.Html ?? "";
        if (html.Length == 0) return (null, Error(ValuationReportDraft.SnapshotRequiredAr));
        if (html.Length > ValuationReportPdfRules.MaxHtmlBytes)
            return (null, Error("حجم التقرير المطبوع أكبر من المسموح"));
        // Checked before the deposit copy is issued: a refused approval must leave nothing frozen.
        if (!DateOnly.TryParseExact(request.ReportDate?.Trim(), "yyyy-MM-dd", out _))
            return (null, Error(ValuationReportDraft.ReportDateInvalidAr));
        if (!ValuationReportDraft.IsApprovalDate(request.ReportDate, _time.GetUtcNow().UtcDateTime))
            return (null, Error(ValuationReportDraft.ReportDateNotTodayAr));

        // The report freezes as the deposit copy (gates, hand-over check and snapshot live there). A
        // retry after a failed second save finds the copy already issued and only completes the approval.
        if (!await ValuationReportFreeze.IsFrozenAsync(db, valuationRequestId, cancellationToken))
        {
            var (_, issueErrors) = await issuance.IssueDepositAsync(valuationRequestId, actor.UserId, cancellationToken);
            if (issueErrors is not null) return (null, issueErrors);
        }

        var bytes = Encoding.UTF8.GetBytes(html);
        var approveError = draft.Approve(
            request.ReportDate,
            ReportDraftSnapshot.Compress(bytes),
            Convert.ToHexString(SHA256.HashData(bytes)),
            bytes.Length,
            actor.UserId,
            _time.GetUtcNow().UtcDateTime);
        if (approveError is not null) return (null, Error(approveError));

        await StageNoticeAsync(
            vr,
            ValuationNoticeAudiences.CaseSpecialist,
            "اعتمد المقيّم تقرير التقييم",
            $"اعتمد المقيّم تقرير التقييم للعقار {vr.DisplayId} وسيرفعه على «قيمة» ويسجّل رمز الإيداع.",
            NotificationContract.Tones.Success,
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    public async Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> WithdrawApprovalAsync(
        Guid valuationRequestId,
        WithdrawReportDraftRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (null, Error("طلب التقييم غير موجود"));
        if (!await IsAssignedAppraiserAsync(vr.PropertyId, actor, cancellationToken))
            return (null, Forbidden(ReviewForbiddenAr));

        var draft = await CurrentDraftAsync(valuationRequestId, tracked: true, cancellationToken);
        if (draft is null || !draft.IsApproved)
            return (await GetAsync(valuationRequestId, cancellationToken), null);

        // The deposit copy goes first: a recorded code or final copy refuses, and nothing changes.
        var (ok, depositError) = await issuance.WithdrawDepositAsync(valuationRequestId, actor.UserId, cancellationToken);
        if (!ok) return (null, Error(depositError ?? "تعذّر سحب الاعتماد"));

        var withdrawError = draft.WithdrawApproval(request.Note, _time.GetUtcNow().UtcDateTime);
        if (withdrawError is not null) return (null, Error(withdrawError));

        await StageNoticeAsync(
            vr,
            ValuationNoticeAudiences.CaseSpecialist,
            "سحب المقيّم اعتماد تقرير التقييم",
            string.IsNullOrWhiteSpace(draft.AppraiserNote)
                ? $"سحب المقيّم اعتماد تقرير التقييم للعقار {vr.DisplayId} لتعديله."
                : $"سحب المقيّم اعتماد تقرير التقييم للعقار {vr.DisplayId}: {draft.AppraiserNote}",
            NotificationContract.Tones.Warn,
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    /// <summary>
    /// The appraiser's package status from Case Study: none | draft | submitted | reopened, or
    /// <c>unknown</c> when that service cannot be read (writes then fail closed).
    /// </summary>
    private async Task<string> PackageStatusAsync(Guid propertyId, CancellationToken cancellationToken)
    {
        if (propertyId == Guid.Empty) return AppraisalPackageStates.None;
        try
        {
            var state = await caseStudy.GetAppraisalPackageStateAsync(propertyId, cancellationToken);
            // A null answer is an older Case Study host without the endpoint: unknown, not «none».
            return state?.PackageStatus ?? PackageStatusUnknown;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return PackageStatusUnknown;
        }
    }

    /// <summary>Only the appraiser assigned to the property — no supervisor / CDO override.</summary>
    private async Task<bool> IsAssignedAppraiserAsync(
        Guid propertyId,
        ReportDraftActor actor,
        CancellationToken cancellationToken)
    {
        var task = await FindAppraisalTaskAsync(propertyId, cancellationToken);
        return task is not null
            && PoRoleMatrixRules.IsAssignedPartyUser(task.AssigneeId, actor.UserId, actor.DistributionAssigneeId);
    }

    /// <summary>The property's latest non-cancelled appraisal task; null when none or Case Study cannot be read.</summary>
    private async Task<CaseStudyWorkflowTaskSnapshotDto?> FindAppraisalTaskAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        try
        {
            var tasks = await caseStudy.ListWorkflowTasksByPropertyAsync(
                propertyId, [WorkflowTaskKind.PropertyAppraisal], cancellationToken);
            return tasks
                .Where(t => !string.Equals(t.Status, WorkflowTaskStatusValues.Cancelled, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(t => t.UpdatedAtUtc)
                .FirstOrDefault();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return null;
        }
    }

    /// <summary>
    /// Where a notice leads: the appraiser's own task page, or the specialist's case-study task. Falls back to the
    /// list page when the task cannot be found.
    /// </summary>
    private async Task<string> NoticeHrefAsync(Guid propertyId, string audience, CancellationToken cancellationToken)
    {
        var forAppraiser = audience == ValuationNoticeAudiences.Appraiser;
        var fallback = forAppraiser ? "/property-appraisal" : "/case-study";
        var task = await FindAppraisalTaskAsync(propertyId, cancellationToken);
        if (task is null) return fallback;
        if (forAppraiser) return $"/property-appraisal/{Uri.EscapeDataString(task.Id.ToString("D"))}";
        return task.ParentTaskId is Guid parent ? $"/case-study/{Uri.EscapeDataString(parent.ToString("D"))}" : fallback;
    }

    private async Task StageNoticeAsync(
        ValuationRequest vr,
        string audience,
        string title,
        string body,
        string tone,
        CancellationToken cancellationToken) =>
        await events.PublishAsync(
            IntegrationEventTypes.ValuationWorkflowNotice,
            new ValuationWorkflowNoticePayload(
                vr.PropertyId.ToString("D"),
                audience,
                title,
                body,
                tone,
                await NoticeHrefAsync(vr.PropertyId, audience, cancellationToken)),
            cancellationToken);

    private static ValuationReportDraftDto ToDto(
        Guid valuationRequestId,
        ValuationReportDraft? draft,
        string packageStatus,
        bool canPrepare,
        ValuationReportIssuance? issuance,
        int version)
    {
        var stage = issuance is null
            ? ReportIssuanceStages.Draft
            : issuance.FinalIssuedAtUtc is not null ? ReportIssuanceStages.FinalIssued : ReportIssuanceStages.DepositIssued;
        if (draft is null)
        {
            return new ValuationReportDraftDto
            {
                ValuationRequestId = valuationRequestId,
                Version = version,
                PackageStatus = packageStatus,
                CanPrepare = canPrepare,
                ReportStage = stage,
                DepositCode = issuance?.DepositCode,
                CertificateFileName = issuance?.CertificateFileName,
                FinalIssuedAtUtc = issuance?.FinalIssuedAtUtc?.ToString("o"),
                FinalReportStatus = issuance?.FinalReportStatus ?? FinalReportStatuses.None,
            };
        }

        using var choices = JsonDocument.Parse(
            string.IsNullOrWhiteSpace(draft.SpecialistChoicesJson) ? ReportDraftChoiceRules.EmptyJson : draft.SpecialistChoicesJson);
        return new ValuationReportDraftDto
        {
            ValuationRequestId = valuationRequestId,
            DraftId = draft.Id,
            Status = draft.Status,
            Version = draft.Version,
            PackageStatus = packageStatus,
            CanPrepare = canPrepare,
            SpecialistChoices = choices.RootElement.Clone(),
            SpecialistNote = draft.SpecialistNote,
            AppraiserNote = draft.AppraiserNote,
            ConformityConfirmedAtUtc = draft.ConformityConfirmedAtUtc?.ToString("o"),
            SentAtUtc = draft.SentAtUtc?.ToString("o"),
            ApprovedAtUtc = draft.ApprovedAtUtc?.ToString("o"),
            ReportDate = draft.ReportDate,
            HasSnapshot = draft.SnapshotHtmlGz is { Length: > 0 },
            SnapshotSha256 = draft.SnapshotSha256,
            UpdatedAtUtc = draft.UpdatedAtUtc.ToString("o"),
            ReportStage = stage,
            DepositCode = issuance?.DepositCode,
            CertificateFileName = issuance?.CertificateFileName,
            FinalIssuedAtUtc = issuance?.FinalIssuedAtUtc?.ToString("o"),
            FinalReportStatus = issuance?.FinalReportStatus ?? FinalReportStatuses.None,
        };
    }
}

/// <summary>The approved printed report is stored gzip-compressed (it embeds photos as data URLs).</summary>
internal static class ReportDraftSnapshot
{
    public static byte[] Compress(byte[] bytes)
    {
        using var output = new MemoryStream();
        using (var gzip = new GZipStream(output, CompressionLevel.Optimal, leaveOpen: true))
            gzip.Write(bytes, 0, bytes.Length);
        return output.ToArray();
    }

    public static string Decompress(byte[] gz)
    {
        using var input = new MemoryStream(gz);
        using var gzip = new GZipStream(input, CompressionMode.Decompress);
        using var reader = new StreamReader(gzip, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
