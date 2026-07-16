using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Builds flat property list rows for dashboard tables without shipping full work-order DTOs.
/// Status/study tracks follow workflow tasks when available.
/// </summary>
public static class PropertyListRowBuilder
{
    private const string IncompleteContactMarkerPhone = "0500000000";
    private const string UnitInsideBuildingClassification = "وحدة داخل مبنى";
    private const string DeedUnderVerification = "قيد التحقق";
    private const string DeedSuspended = "موقوف";
    private const string CaseStudyPropertyKind = "case-study-property";
    private const string EngineeringSurveyKind = "engineering-survey";
    private const string PropertyAppraisalKind = "property-appraisal";

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

    private static Dictionary<string, string> BuildPriorDeedIndex(IReadOnlyList<WorkOrder> orders)
    {
        var priorByDeed = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var order in orders)
        {
            foreach (var prop in order.Properties.Where(p => !p.IsRemoved))
            {
                if (prop.IdentifierType != PropertyIdentifierType.Deed) continue;
                var deed = prop.DeedNumber.Trim();
                if (deed.Length == 0) continue;
                priorByDeed[deed] = order.PoNumber;
            }
        }

        return priorByDeed;
    }

    private static PropertyListItemDto BuildItem(
        WorkOrder order,
        WorkOrderProperty prop,
        Dictionary<string, string> priorByDeed,
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
        var surveyFromTasks = ResolveKindStage(propertyTasks, EngineeringSurveyKind);
        var valFromTasks = ResolveKindStage(propertyTasks, PropertyAppraisalKind);
        var studyFromTasks = ResolveStudyStage(propertyTasks);

        var survey = boursePending
            ? "new"
            : surveyFromTasks
                ?? (PriorSurveyWaived(prop, priorByDeed) ? "done" : "new");

        var study = boursePending
            ? "progress"
            : studyFromTasks
                ?? (underVerification ? "progress" : "new");

        var status = boursePending
            ? "progress"
            : isFailed
                ? "fail"
                : incomplete
                    ? "incomplete"
                    : fromTasks
                        ?? (underVerification ? "progress" : "new");

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
                Val = valFromTasks ?? "new",
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
            .Where(t => !string.Equals(t.Status, WorkflowTaskStatus.Cancelled, StringComparison.Ordinal))
            .ToList();
        if (active.Count == 0) return "fail";

        // «مكتمل» فقط عند رفع نموذج الدراسة للنظام (اكتمال مهمة دراسة الحالة).
        var parent = active.FirstOrDefault(t =>
            string.Equals(t.Kind, CaseStudyPropertyKind, StringComparison.Ordinal));
        if (parent is not null &&
            (string.Equals(parent.Status, WorkflowTaskStatus.Completed, StringComparison.Ordinal) ||
             string.Equals(parent.Phase, "done", StringComparison.Ordinal)))
        {
            return "done";
        }

        var started = active.Any(t =>
            string.Equals(t.Status, WorkflowTaskStatus.Completed, StringComparison.Ordinal) ||
            string.Equals(t.Phase, "distribution", StringComparison.Ordinal) ||
            string.Equals(t.Phase, "case-study", StringComparison.Ordinal) ||
            string.Equals(t.Phase, "done", StringComparison.Ordinal) ||
            !string.Equals(t.Kind, CaseStudyPropertyKind, StringComparison.Ordinal));

        return started ? "progress" : "new";
    }

    private static string? ResolveKindStage(IReadOnlyList<WorkflowTask> propertyTasks, string kind)
    {
        var task = propertyTasks.FirstOrDefault(t =>
            string.Equals(t.Kind, kind, StringComparison.Ordinal));
        if (task is null) return null;
        if (string.Equals(task.Status, WorkflowTaskStatus.Cancelled, StringComparison.Ordinal))
            return "new";
        if (string.Equals(task.Status, WorkflowTaskStatus.Completed, StringComparison.Ordinal))
            return "done";
        return "progress";
    }

    private static string? ResolveStudyStage(IReadOnlyList<WorkflowTask> propertyTasks)
    {
        var parent = propertyTasks.FirstOrDefault(t =>
            string.Equals(t.Kind, CaseStudyPropertyKind, StringComparison.Ordinal));
        if (parent is null) return null;
        if (string.Equals(parent.Status, WorkflowTaskStatus.Completed, StringComparison.Ordinal) ||
            string.Equals(parent.Phase, "done", StringComparison.Ordinal))
            return "done";
        if (string.Equals(parent.Phase, "case-study", StringComparison.Ordinal) ||
            string.Equals(parent.Phase, "distribution", StringComparison.Ordinal) ||
            string.Equals(parent.Status, WorkflowTaskStatus.Open, StringComparison.Ordinal) ||
            string.Equals(parent.Status, WorkflowTaskStatus.Blocked, StringComparison.Ordinal))
            return "progress";
        return "new";
    }

    private static string PropertyRowId(string poNumber, WorkOrderProperty prop)
    {
        var deed = prop.DeedNumber.Trim();
        if (deed.Length > 0) return deed;
        var id = prop.Id.ToString();
        var suffix = id.Length >= 8 ? id[..8] : id;
        return $"{poNumber}-{suffix}";
    }

    private static bool PriorSurveyWaived(
        WorkOrderProperty prop,
        Dictionary<string, string> priorByDeed)
    {
        if (!ClassificationRequiresSurvey(prop.Classification)) return true;
        var deed = prop.DeedNumber.Trim();
        return deed.Length > 0 && priorByDeed.ContainsKey(deed);
    }

    private static bool ClassificationRequiresSurvey(string classification) =>
        !string.Equals(
            classification.Trim(),
            UnitInsideBuildingClassification,
            StringComparison.Ordinal);

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
        new string(phone.Where(char.IsDigit).ToArray());

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
