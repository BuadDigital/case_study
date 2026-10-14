using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Appraisal reopen gates: a package whose valuation report is frozen as the deposit copy,
/// or whose final report is issued, is not returned for correction from here.
/// </summary>
public partial class PartyTaskSubmissionService
{
    public const string AppraisalFinalIssuedReopenForbiddenAr =
        "صدر التقرير النهائي — يُعدَّل بنسخة جديد من الأخصائي بعد إعادة فتح التقييم";

    public const string AppraisalReportApprovedReopenForbiddenAr =
        "اعتمد المقيّم تقرير التقييم — يسحب اعتماده أولاً قبل إعادة الحزمة للتصحيح";

    /// <summary>The valuation request is open and its report is frozen as the deposit copy (approved, no final yet).</summary>
    private async Task<bool> AppraisalReportApprovedAsync(WorkflowTask task, CancellationToken cancellationToken)
    {
        if (_valuationRequests is null || task.PropertyId is not Guid propertyId) return false;
        var open = await _valuationRequests.GetOpenByPropertyAsync(propertyId.ToString("D"), cancellationToken);
        return string.Equals(open?.ReportStage, ValuationReportStageWire.DepositIssued, StringComparison.Ordinal);
    }

    /// <summary>
    /// The appraisal task is completed AND the property's valuation request is closed (the final
    /// issuance happened). A completed task with a still-open request is a legacy transaction
    /// (completed at hand-over) and stays reopenable. Absent valuation port reads as «not issued».
    /// </summary>
    private async Task<bool> AppraisalFinalIssuedAsync(WorkflowTask task, CancellationToken cancellationToken)
    {
        if (task.Status != WorkflowTaskStatus.Completed
            || _valuationRequests is null
            || task.PropertyId is not Guid propertyId)
            return false;
        return await _valuationRequests.GetOpenByPropertyAsync(propertyId.ToString("D"), cancellationToken) is null;
    }
}
