using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Builds flat property list rows for dashboard tables without shipping full work-order DTOs.
/// Mirrors <c>work-orders-read.ts</c> client mapping.
/// </summary>
public static class PropertyListRowBuilder
{
    private const string IncompleteContactMarkerPhone = "0500000000";
    private const string UnitInsideBuildingClassification = "وحدة داخل مبنى";
    private const string DeedUnderVerification = "قيد التحقق";
    private const string DeedSuspended = "موقوف";

    public static IReadOnlyList<PropertyListItemDto> Build(
        IReadOnlyList<WorkOrder> orders,
        IReadOnlySet<string> approvedFailureKeys)
    {
        var priorByDeed = BuildPriorDeedIndex(orders);
        var items = new List<PropertyListItemDto>();

        foreach (var order in orders)
        {
            foreach (var prop in order.Properties.OrderBy(p => p.DeedNumber))
            {
                items.Add(BuildItem(order, prop, priorByDeed, approvedFailureKeys));
            }
        }

        return items;
    }

    private static Dictionary<string, string> BuildPriorDeedIndex(IReadOnlyList<WorkOrder> orders)
    {
        var priorByDeed = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var order in orders)
        {
            foreach (var prop in order.Properties)
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
        IReadOnlySet<string> approvedFailureKeys)
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

        var survey = boursePending
            ? "new"
            : PriorSurveyWaived(prop, priorByDeed)
                ? "done"
                : "new";

        var study = boursePending
            ? "progress"
            : underVerification
                ? "progress"
                : "new";

        var status = boursePending
            ? "progress"
            : isFailed
                ? "fail"
                : incomplete
                    ? "incomplete"
                    : underVerification
                        ? "progress"
                        : "new";

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
                Val = "new",
                Study = study,
                Status = status,
                Specialist = order.AssignmentSpecialist ?? "",
            },
        };
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
