using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// Builds flat property list rows for dashboard tables without shipping full work-order DTOs.
/// Status/study tracks follow workflow tasks when available.
/// </summary>
public static class PropertyListRowBuilder
{
    private const string IncompleteContactMarkerPhone = "0500000000";
    private const string DeedUnderVerification = "قيد التحقق";
    private const string DeedSuspended = "موقوف";
    public static IReadOnlyList<PropertyListItemDto> Build(
        IReadOnlyList<WorkOrder> orders,
        IReadOnlySet<string> approvedFailureKeys,
        IReadOnlyDictionary<Guid, IReadOnlyList<WorkflowTask>>? tasksByProperty = null)
    {
        var priorByDeed = BuildPriorDeedIndex(orders);
        var items = new List<PropertyListItemDto>();

        foreach (var order in orders)
        {
            foreach (var prop in order.Properties.Where(p => !p.IsRemoved).OrderBy(p => p.DeedNumber))
            {
                items.Add(BuildItem(order, prop, priorByDeed, approvedFailureKeys, tasksByProperty));
            }
        }

        return items;
    }

 /// <summary>
 /// Maps normalized deed → PO numbers that contain it.
 /// Used so a property cannot satisfy «prior survey» by matching itself.
 /// </summary>
    private static Dictionary<string, HashSet<string>> BuildPriorDeedIndex(IReadOnlyList<WorkOrder> orders)
    {
        var priorByDeed = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var order in orders)
        {
            var po = order.PoNumber?.Trim() ?? "";
            if (po.Length == 0) continue;
            foreach (var prop in order.Properties.Where(p => !p.IsRemoved))
            {
                var deed = DeedNumberRules.Normalize(prop.DeedNumber);
                if (deed.Length == 0 || deed.StartsWith("INQ-", StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!priorByDeed.TryGetValue(deed, out var pos))
                {
                    pos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    priorByDeed[deed] = pos;
                }

                pos.Add(po);
            }
        }

        return priorByDeed;
    }

    private static PropertyListItemDto BuildItem(
        WorkOrder order,
        WorkOrderProperty prop,
        Dictionary<string, HashSet<string>> priorByDeed,
        IReadOnlySet<string> approvedFailureKeys,
        IReadOnlyDictionary<Guid, IReadOnlyList<WorkflowTask>>? tasksByProperty)
    {
        var propertyId = prop.Id.ToString();
        var failureKey = $"{order.PoNumber.Trim()}|{propertyId}";
        var hasApprovedFailure = approvedFailureKeys.Contains(failureKey);

        var boursePending = !prop.BourseDataCompleted;
        var underVerification = string.Equals(
            prop.DeedStatus,
            DeedUnderVerification,
            StringComparison.Ordinal);
        var isFailed = hasApprovedFailure ||
            string.Equals(prop.DeedStatus, DeedSuspended, StringComparison.Ordinal);
        var incomplete = HasIncompleteContact(prop);

        var city = prop.City ?? "";
        var district = prop.District ?? "";
        var area = boursePending
            ? "بانتظار البورصة"
            : district.Length > 0
                ? $"{city} · {district}"
                : city.Length > 0 ? city : "—";

        var propertyTasks = tasksByProperty is not null &&
            tasksByProperty.TryGetValue(prop.Id, out var listed)
            ? listed
            : Array.Empty<WorkflowTask>();

        var fromTasks = ResolveStatusFromTasks(propertyTasks);
        var surveyFromTasks = ResolveKindStage(propertyTasks, WorkflowTaskKind.EngineeringSurvey);
        var valFromTasks = ResolveKindStage(propertyTasks, WorkflowTaskKind.PropertyAppraisal);
        var studyFromTasks = ResolveStudyStage(propertyTasks);

        var survey = boursePending
            ? PropertyListRowStatuses.New
            : surveyFromTasks
                ?? (PriorSurveyWaived(prop, order.PoNumber, priorByDeed)
                    ? PropertyListRowStatuses.Done
                    : PropertyListRowStatuses.New);

        var study = boursePending
            ? PropertyListRowStatuses.Progress
            : studyFromTasks
                ?? (underVerification
                    ? PropertyListRowStatuses.Progress
                    : PropertyListRowStatuses.New);

        var status = boursePending
            ? PropertyListRowStatuses.Progress
            : isFailed
                ? PropertyListRowStatuses.Fail
                : incomplete
                    ? PropertyListRowStatuses.Incomplete
                    : fromTasks
                        ?? (underVerification
                            ? PropertyListRowStatuses.Progress
                            : PropertyListRowStatuses.New);

        return new PropertyListItemDto
        {
            PoNumber = order.PoNumber,
            PropertyId = propertyId,
            Row = new PropertyListRowDto
            {
                Id = PropertyRowId(order.PoNumber, prop),
                Po = order.PoNumber,
                Area = area,
                Type = boursePending
                    ? "—"
                    : FirstNonEmpty(prop.PropertyType, prop.Classification, "—"),
                Key = false,
                Survey = survey,
                Val = valFromTasks ?? PropertyListRowStatuses.New,
                Study = study,
                Status = status,
                Specialist = order.AssignmentSpecialist ?? "",
            },
        };
    }

    private static string? ResolveStatusFromTasks(IReadOnlyList<WorkflowTask> propertyTasks)
    {
        if (propertyTasks.Count == 0) return null;

        var active = propertyTasks
            .Where(t => t.Status != WorkflowTaskStatus.Cancelled)
            .ToList();
        if (active.Count == 0) return PropertyListRowStatuses.Fail;

 // «مكتمل» فقط عند رفع نموذج الدراسة للنظام (اكتمال مهمة دراسة الحالة).
        var parent = active.FirstOrDefault(t => t.Kind == WorkflowTaskKind.CaseStudyProperty);
        if (parent is not null &&
            (parent.Status == WorkflowTaskStatus.Completed || parent.Phase == WorkflowTaskPhase.Done))
        {
            return PropertyListRowStatuses.Done;
        }

        var started = active.Any(t =>
            t.Status == WorkflowTaskStatus.Completed ||
            t.Phase is WorkflowTaskPhase.Distribution
                or WorkflowTaskPhase.CaseStudy
                or WorkflowTaskPhase.Done ||
            t.Kind != WorkflowTaskKind.CaseStudyProperty);

        return started ? PropertyListRowStatuses.Progress : PropertyListRowStatuses.New;
    }

    private static string? ResolveKindStage(
        IReadOnlyList<WorkflowTask> propertyTasks,
        WorkflowTaskKind kind)
    {
        var task = propertyTasks.FirstOrDefault(t => t.Kind == kind);
        if (task is null) return null;
        if (task.Status == WorkflowTaskStatus.Cancelled) return PropertyListRowStatuses.New;
        if (task.Status == WorkflowTaskStatus.Completed) return PropertyListRowStatuses.Done;
        return PropertyListRowStatuses.Progress;
    }

    private static string? ResolveStudyStage(IReadOnlyList<WorkflowTask> propertyTasks)
    {
        var parent = propertyTasks.FirstOrDefault(t => t.Kind == WorkflowTaskKind.CaseStudyProperty);
        if (parent is null) return null;
        if (parent.Status == WorkflowTaskStatus.Completed || parent.Phase == WorkflowTaskPhase.Done)
            return PropertyListRowStatuses.Done;
        if (parent.Phase is WorkflowTaskPhase.CaseStudy or WorkflowTaskPhase.Distribution ||
            parent.Status is WorkflowTaskStatus.Open or WorkflowTaskStatus.Blocked)
            return PropertyListRowStatuses.Progress;
        return PropertyListRowStatuses.New;
    }

    private static string PropertyRowId(string poNumber, WorkOrderProperty prop)
    {
        var deed = prop.DeedNumber.Trim();
        if (deed.Length > 0) return deed;
        var id = prop.Id.ToString();
        var suffix = id.Length >= 8 ? id[..8] : id;
        return $"{poNumber}-{suffix}";
    }

 /// <summary>
 /// Survey waived when classification does not require it, the property has
 /// a registered title (سجل عيني), or the same deed already exists on a
 /// different work order (true prior registration).
 /// </summary>
    private static bool PriorSurveyWaived(
        WorkOrderProperty prop,
        string currentPoNumber,
        Dictionary<string, HashSet<string>> priorByDeed)
    {
        if (!SurveyRequirementRules.PropertyRequiresSurvey(prop)) return true;
        var deed = DeedNumberRules.Normalize(prop.DeedNumber);
        if (deed.Length == 0) return false;
        if (!priorByDeed.TryGetValue(deed, out var pos) || pos.Count == 0) return false;
        var currentPo = currentPoNumber.Trim();
        return pos.Any(po => !string.Equals(po, currentPo, StringComparison.OrdinalIgnoreCase));
    }

    private static bool HasIncompleteContact(WorkOrderProperty prop)
    {
        var markerDigits = NormalizePhoneDigits(IncompleteContactMarkerPhone);
        var markerWithoutLeadingZero = markerDigits.TrimStart('0');

        foreach (var contact in prop.Contacts)
        {
            var digits = NormalizePhoneDigits(contact.Phone);
            if (digits == markerDigits || digits == markerWithoutLeadingZero)
                return true;
        }

        return false;
    }

    private static string NormalizePhoneDigits(string phone) =>
        Texts.DigitsOnly(phone);

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            var trimmed = value?.Trim();
            if (!string.IsNullOrEmpty(trimmed)) return trimmed;
        }

        return "—";
    }
}
