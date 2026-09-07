using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Pure projections and edits behind Enfaz revenue: the ready-PO summary, the revenue line of a
/// property, what a finance save writes onto a line, the per-property revenue answer, and the
/// tracking row. The service loads the rows and saves; nothing here touches storage.
/// </summary>
public static class PoEnfazRevenueRules
{
    /// <summary>Request number, else deed number, then the district when there is one.</summary>
    public static string PropertyLineLabel(CaseStudyPropertySnapshotDto property)
    {
        var label = string.IsNullOrWhiteSpace(property.RequestNumber)
            ? property.DeedNumber.Trim()
            : property.RequestNumber.Trim();
        if (!string.IsNullOrWhiteSpace(property.District))
            label = $"{label} — {property.District.Trim()}";
        return label;
    }

    /// <summary>Lines are listed by request number, falling back to the deed number.</summary>
    public static string PropertyOrderKey(CaseStudyPropertySnapshotDto property) =>
        string.IsNullOrWhiteSpace(property.RequestNumber) ? property.DeedNumber : property.RequestNumber;

    /// <summary>A property nobody computed a work status for is still in progress.</summary>
    public static (string Status, string Label) WorkOrInProgress(
        IReadOnlyDictionary<Guid, (string Status, string Label)> statuses,
        Guid propertyId) =>
        statuses.GetValueOrDefault(
            propertyId,
            (InspectorFeeWorkStatuses.InProgress, InspectorFeeBillingRules.WorkStatusLabel(InspectorFeeWorkStatuses.InProgress)));

    /// <summary>
    /// Ready POs with their done / cancelled property counts; null when the PO is not ready. A
    /// property with no tasks counts as neither.
    /// </summary>
    public static EnfazReadyPoSummaryDto? ReadySummary(
        string poNumber,
        IReadOnlyList<CaseStudyPropertySnapshotDto> properties,
        IReadOnlyList<WorkflowTask> poTasks)
    {
        if (!PoEnfazWorkStatusRules.IsPoReadyForEnfazBilling(properties, poTasks))
            return null;

        var done = 0;
        var cancelled = 0;
        foreach (var property in properties)
        {
            var propertyTasks = poTasks.Where(t => t.PropertyId == property.Id).ToList();
            if (propertyTasks.Count == 0)
                continue;

            if (propertyTasks.All(t => t.Status == WorkflowTaskStatus.Cancelled))
                cancelled += 1;
            else
                done += 1;
        }

        return new EnfazReadyPoSummaryDto
        {
            PoNumber = poNumber,
            DoneCount = done,
            CancelledCount = cancelled,
        };
    }

    /// <summary>One entitlement per property: the first row listed wins.</summary>
    public static Dictionary<Guid, PropertyKeyEntitlement> FirstEntitlementPerProperty(
        IEnumerable<PropertyKeyEntitlement> rows)
    {
        var map = new Dictionary<Guid, PropertyKeyEntitlement>();
        foreach (var row in rows)
        {
            if (map.ContainsKey(row.PropertyId))
                continue;

            map[row.PropertyId] = row;
        }

        return map;
    }

    /// <summary>
    /// The revenue line of a property: stored amounts when finance entered any, else zeros; the
    /// key envelope comes from the stored link, else from the property's entitlement.
    /// </summary>
    public static PoEnfazRevenueLineDto ToRevenueLineDto(
        string poNumber,
        CaseStudyPropertySnapshotDto property,
        (string Status, string Label) work,
        PoEnfazRevenueLine? row,
        PropertyKeyEntitlement? entitlement)
    {
        var hasEntitlement = entitlement is not null;
        var envelopeId = row?.KeyEntitlementEnvelopeId
            ?? (hasEntitlement ? entitlement!.EnvelopeId : (Guid?)null);
        IReadOnlyList<string> keyAttachments = hasEntitlement
            ? entitlement!.AttachmentIds
            : [];
        return new PoEnfazRevenueLineDto
        {
            Id = row?.Id.ToString() ?? "",
            PoNumber = poNumber,
            PropertyId = property.Id.ToString(),
            PropertyLabel = PropertyLineLabel(property),
            WorkStatus = work.Status,
            WorkStatusLabel = work.Label,
            CaseStudyFeeSar = row?.CaseStudyFeeSar ?? 0m,
            SurveyFeeSar = row?.SurveyFeeSar ?? 0m,
            KeyFeeSar = row?.KeyFeeSar ?? 0m,
            KeyEntitlementEnvelopeId = envelopeId?.ToString(),
            HasKeyEntitlement = hasEntitlement || row?.KeyEntitlementEnvelopeId is not null,
            KeyAttachmentIds = keyAttachments,
            EnfazFeeSar = row?.TotalFeeSar
                ?? ((row?.CaseStudyFeeSar ?? 0m) + (row?.SurveyFeeSar ?? 0m) + (row?.KeyFeeSar ?? 0m)),
            IncludedInBilling = row?.IncludedInBilling ?? work.Status != InspectorFeeWorkStatuses.Cancelled,
        };
    }

    /// <summary>A save input names a property of the PO, or it is ignored.</summary>
    public static bool TryParseLineProperty(
        PoEnfazRevenueLineInput input,
        IReadOnlySet<Guid> validPropertyIds,
        out Guid propertyId) =>
        Guid.TryParse(input.PropertyId.Trim(), out propertyId)
        && validPropertyIds.Contains(propertyId);

    /// <summary>
    /// Writes one save input onto its line. Negative amounts clamp to zero; the envelope link is
    /// replaced when resent, kept when a key fee stands without one, and dropped with the fee.
    /// </summary>
    public static void ApplyLineInput(PoEnfazRevenueLine row, PoEnfazRevenueLineInput input, DateTime nowUtc)
    {
        row.CaseStudyFeeSar = Math.Max(0m, input.CaseStudyFeeSar);
        row.SurveyFeeSar = Math.Max(0m, input.SurveyFeeSar);
        row.KeyFeeSar = Math.Max(0m, input.KeyFeeSar);
        if (Guid.TryParse(input.KeyEntitlementEnvelopeId, out var envelopeId))
            row.KeyEntitlementEnvelopeId = envelopeId;
        else if (row.KeyFeeSar > 0 && row.KeyEntitlementEnvelopeId is null)
        {
 // Keep link if finance entered a key fee without resending envelope id.
        }
        else if (row.KeyFeeSar <= 0)
            row.KeyEntitlementEnvelopeId = null;
        row.IncludedInBilling = input.IncludedInBilling;
        row.UpdatedAtUtc = nowUtc;
    }

    /// <summary>A key fee entered without an envelope link takes the property's entitlement.</summary>
    public static void LinkMissingEnvelopes(
        IEnumerable<PoEnfazRevenueLine> rows,
        IReadOnlyDictionary<Guid, PropertyKeyEntitlement> entitlements)
    {
        foreach (var row in rows)
        {
            if (row.KeyFeeSar > 0
                && row.KeyEntitlementEnvelopeId is null
                && entitlements.TryGetValue(row.PropertyId, out var info))
            {
                row.KeyEntitlementEnvelopeId = info.EnvelopeId;
            }
        }
    }

    /// <summary>Revenue counts only when the line is billed and carries an amount.</summary>
    public static PropertyEnfazRevenueDto PropertyRevenue(PoEnfazRevenueLine? row)
    {
        if (row is null || !row.IncludedInBilling || row.TotalFeeSar <= 0)
        {
            return new PropertyEnfazRevenueDto
            {
                HasEnfazRevenue = false,
                CaseStudyFeeSar = null,
                SurveyFeeSar = null,
                EnfazFeeSar = null,
            };
        }

        return new PropertyEnfazRevenueDto
        {
            HasEnfazRevenue = true,
            CaseStudyFeeSar = row.CaseStudyFeeSar,
            SurveyFeeSar = row.SurveyFeeSar,
            EnfazFeeSar = row.TotalFeeSar,
        };
    }

    /// <summary>
    /// One tracking row per property. The completion date is the bourse date, else the last
    /// completed task, and only while the work is done.
    /// </summary>
    public static EnfazTrackingRowDto ToTrackingRow(
        string poNumber,
        CaseStudyPropertySnapshotDto property,
        (string Status, string Label) work,
        PoEnfazRevenueLine? enfaz,
        DateTime? taskCompletedAtUtc,
        PoEnfazInvoice? invoice,
        bool overdue,
        PoEnfazFinanceFlag? flag,
        int followupCount)
    {
        var filled = enfaz is not null && enfaz.IncludedInBilling && enfaz.TotalFeeSar > 0;
        var completedAt = property.BourseCompletedAtUtc ?? taskCompletedAtUtc;
        if (work.Status != InspectorFeeWorkStatuses.Done)
            completedAt = null;

        return new EnfazTrackingRowDto
        {
            PoNumber = poNumber,
            PropertyId = property.Id.ToString(),
            PropertyLabel = PropertyLineLabel(property),
            DeedNumber = (property.DeedNumber ?? string.Empty).Trim(),
            City = (property.City ?? string.Empty).Trim(),
            LandArea = (property.Area ?? string.Empty).Trim(),
            CompletedAtUtc = completedAt,
            WorkStatus = work.Status,
            WorkStatusLabel = work.Label,
            EnfazFilled = filled,
            CaseStudyFeeSar = enfaz?.CaseStudyFeeSar ?? 0m,
            SurveyFeeSar = enfaz?.SurveyFeeSar ?? 0m,
            KeyFeeSar = enfaz?.KeyFeeSar ?? 0m,
            EnfazFeeSar = enfaz?.TotalFeeSar ?? 0m,
            InvoiceNumber = invoice?.InvoiceNumber,
            InvoiceStatus = invoice?.Status,
            CollectedAmountSar = invoice?.CollectedAmountSar ?? 0m,
            InvoiceIssuedAtUtc = invoice?.IssuedAtUtc,
            IsOverdue = overdue,
            FinanceFlag = flag?.Flag,
            FinanceFlagNote = flag?.Note,
            FollowupCount = followupCount,
        };
    }
}
