using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

internal static class PartyBillingRowMapper
{
    internal static PartyBillingReadyLineDto ToReadyDto(
        InspectorFeeLedger ledger,
        IReadOnlyDictionary<Guid, string> labels,
        WorkflowTaskKind? kind)
    {
        var discount = Math.Max(0m, ledger.SupervisorDiscountSar);
        var resolved = kind ?? WorkflowTaskKind.EngineeringSurvey;
        var payeeType = PartyBillingPayeeType.FromTaskKind(resolved);
        return new PartyBillingReadyLineDto
        {
            WorkflowTaskId = ledger.WorkflowTaskId.ToString(),
            PropertyId = ledger.PropertyId?.ToString(),
            PropertyLabel = ledger.PropertyId is { } pid && labels.TryGetValue(pid, out var label)
                ? label
                : ledger.PropertyOrdinal.ToString(),
            PoNumber = ledger.PoNumber,
            AssigneeId = ledger.AssigneeId,
            TaskKind = resolved.ToDbValue(),
            PayeeType = payeeType,
            PayeeTypeLabel = PartyBillingPayeeType.Label(payeeType),
            AgreedFeeSar = ledger.AgreedFeeSar,
            SupervisorDiscountSar = discount,
            NetFeeSar = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, discount),
            BillingStatus = ledger.BillingStatus,
            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(ledger.BillingStatus),
            AccruedAtUtc = ledger.AccruedAtUtc,
            UpdatedAtUtc = ledger.UpdatedAtUtc,
        };
    }

    internal static PartyBillingReadyLineDto ToCourtVisitReadyDto(CourtVisitFeeCharge charge)
    {
        var label = string.IsNullOrWhiteSpace(charge.TaskDisplayId)
            ? "زيارة محكمة"
            : charge.TaskDisplayId.Trim();
        if (!string.IsNullOrWhiteSpace(charge.CreditAssigneeName))
            label = $"{label} — {charge.CreditAssigneeName.Trim()}";

        return new PartyBillingReadyLineDto
        {
            WorkflowTaskId = charge.Id.ToString(),
            PropertyId = null,
            PropertyLabel = label,
            PoNumber = charge.PoNumber ?? "",
            AssigneeId = charge.CreditAssigneeId,
            TaskKind = PartyBillingStatementService.CourtVisitTaskKind,
            PayeeType = PartyBillingPayeeType.Individual,
            PayeeTypeLabel = PartyBillingPayeeType.Label(PartyBillingPayeeType.Individual),
            AgreedFeeSar = charge.AmountSar,
            SupervisorDiscountSar = 0m,
            NetFeeSar = charge.AmountSar,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(InspectorFeeBillingStatus.AtFinance),
            AccruedAtUtc = charge.CreatedAtUtc,
            UpdatedAtUtc = charge.UpdatedAtUtc,
        };
    }

    internal static List<PartyBillingRejectedInvoiceDto> ParseRejected(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<PartyBillingRejectedInvoiceDto>>(json)
                ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }

    internal static string? SerializeRejected(IReadOnlyList<PartyBillingRejectedInvoiceDto> items)
    {
        if (items.Count == 0) return null;
        return System.Text.Json.JsonSerializer.Serialize(items);
    }

    internal static List<Guid> ParseTaskIds(IReadOnlyList<string> raw) =>
        raw.Select(id => Guid.TryParse(id, out var g) ? g : (Guid?)null)
            .Where(g => g.HasValue)
            .Select(g => g!.Value)
            .Distinct()
            .ToList();

 /// <summary>
 /// Keeps one ledger per workflow-task + property/deed so legacy reassignment twins
 /// (same task+property, different <see cref="InspectorFeeLedger.UserId"/>) do not
 /// duplicate ready lines or break statement creation counts.
 /// Prefers rows where UserId matches AssigneeId, then newest update.
 /// </summary>
    internal static IEnumerable<InspectorFeeLedger> CollapseReadyLedgers(
        IEnumerable<InspectorFeeLedger> ledgers) =>
        ledgers
            .GroupBy(l => (
                l.WorkflowTaskId,
                PropertyKey: l.PropertyId
                    ?? (l.DeedId == Guid.Empty ? l.Id : l.DeedId)))
            .Select(g => g
                .OrderByDescending(l =>
                    !string.IsNullOrWhiteSpace(l.AssigneeId)
                    && string.Equals(
                        l.UserId?.Trim(),
                        l.AssigneeId.Trim(),
                        StringComparison.Ordinal)
                        ? 1
                        : 0)
                .ThenByDescending(l => l.UpdatedAtUtc)
                .ThenByDescending(l => l.CreatedAtUtc)
                .First());

    internal static WorkflowTaskKind ParseKind(string? raw) =>
        WorkflowTaskKindValues.TryParse(raw, out var kind)
            || Enum.TryParse(raw, true, out kind)
            ? kind
            : WorkflowTaskKind.CaseStudyProperty;
}
