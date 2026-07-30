using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Slot / child-task factory helpers and phase title rules for workflow sync.
/// </summary>
public static class WorkflowTaskPhaseRules
{
    public const string CaseStudyPropertyKind = WorkflowTaskKindValues.CaseStudyProperty;

    /// <summary>
    /// A real-estate registration needs no bourse inquiry, so it goes straight to distribution;
    /// a deed only skips the bourse phase once its inquiry data is in.
    /// </summary>
    public static WorkflowTaskPhase PhaseAfterEnfath(string identifierType, bool bourseCompleted)
    {
        if (identifierType == PropertyIdentifierTypeLabels.RealEstateReg)
            return WorkflowTaskPhase.Distribution;
        if (bourseCompleted) return WorkflowTaskPhase.Distribution;
        return WorkflowTaskPhase.Bourse;
    }

    public static string SlotTaskTitle(string poNumber, int ordinal, int total) =>
        $"تسجيل عقار {ordinal} من {total} — {poNumber}";

    public static string PropertyTaskTitle(string deed, string poNumber)
    {
        var d = deed.Trim();
        return string.IsNullOrEmpty(d) ? $"عقار — {poNumber}" : $"{d} — {poNumber}";
    }

    public static string FormatDeedDisplay(WorkOrderProperty prop)
    {
        var deed = prop.DeedNumber.Trim();
        if (!string.IsNullOrEmpty(deed) && !deed.StartsWith("INQ-", StringComparison.Ordinal))
            return deed;
        if (prop.IdentifierType == PropertyIdentifierType.BourseInquiry ||
            deed.StartsWith("INQ-", StringComparison.Ordinal))
        {
            return "استعلام بورصة — بانتظار البيانات";
        }
        return string.IsNullOrEmpty(deed) ? "—" : deed;
    }

    public static string PartyAssignedTitle(WorkflowTaskKind kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "تعيين المعاين الميداني",
        WorkflowTaskKind.EngineeringSurvey => "تعيين المكتب الهندسي",
        WorkflowTaskKind.PropertyAppraisal => "تعيين المقيّم العقاري",
        WorkflowTaskKind.GovernmentReview => "تعيين المراجع الحكومي",
        WorkflowTaskKind.ValuationCoordination => "تعيين منسق التقييم",
        _ => "تعيين طرف",
    };

    /// <summary>The shell keys assignee display names by the wire kind value.</summary>
    public static string ResolveName(
        Dictionary<string, string> names,
        WorkflowTaskKind kind,
        string fallback) =>
        names.TryGetValue(kind.ToDbValue(), out var name) && !string.IsNullOrWhiteSpace(name)
            ? name.Trim()
            : fallback;

    public static TaskDistributionDraftDto NormalizeDistribution(TaskDistributionDraftDto dto)
    {
        if (!dto.GovernmentAuditor) dto.GovernmentAuditorId = "";
        if (!dto.ValuationDepartment)
        {
            dto.OperationsCoordinatorId = "";
            dto.InspectorId = "";
            dto.ValuatorId = "";
        }
        if (!dto.EngineeringOffice) dto.EngineeringOfficeId = "";
        return dto;
    }

    public static WorkflowTask NewSlotTask(
        string poNumber,
        int ordinal,
        int total,
        string? assignmentType,
        string distributionJson) =>
        WorkflowTask.CreateCaseStudySlot(
            poNumber,
            ordinal,
            SlotTaskTitle(poNumber, ordinal, total),
            distributionJson,
            assignmentType,
            DateTime.UtcNow);

    public static WorkflowTask SpawnChild(
        WorkflowTask parent,
        WorkflowTaskKind kind,
        string role,
        string defaultName,
        string assigneeId,
        string deed,
        DateTime now) =>
        WorkflowTask.CreatePartyChild(
            parent,
            kind,
            role,
            defaultName,
            assigneeId,
            PartyTaskTitle(kind, string.IsNullOrWhiteSpace(deed) ? parent.PoNumber : deed),
            now);

    public static string PartyTaskTitle(WorkflowTaskKind kind, string refLabel) => kind switch
    {
        WorkflowTaskKind.FieldInspection => $"معاينة ميدانية — {refLabel}",
        WorkflowTaskKind.GovernmentReview => $"مراجعة حكومية — {refLabel}",
        WorkflowTaskKind.ValuationCoordination => $"منسق التقييم — {refLabel}",
        WorkflowTaskKind.PropertyAppraisal => $"تقييم عقاري — {refLabel}",
        _ => $"رفع مساحي — {refLabel}",
    };
}
