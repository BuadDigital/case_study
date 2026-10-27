// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Income New file — D17 income approach by direct capitalisation: save (refused while frozen, handed
//           over or not enabled in the settings; validated by ValuationIncomeApproachRequestRules) and read.
//  • Income ToDto computes the chain from the stored inputs — EGI, operating expenses, NOI = EGI − opex,
//           value = NOI ÷ cap rate, IsComplete; nothing derived is stored.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Application;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

/// <summary>
/// D17 — income approach by direct capitalisation. Persistence goes through
/// <see cref="IValuationIncomeApproachRepository"/> and the ق-6 / hand-over lock through
/// <see cref="IValuationReportFreezeGate"/> (same gate as the cost approach); this file holds
/// rules only — no EF.
/// </summary>
public sealed class ValuationIncomeApproachService(
    IValuationIncomeApproachRepository repo,
    IValuationReportFreezeGate freeze,
    TimeProvider? time = null) : IValuationIncomeApproachService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public const string NotEnabledAr = "أسلوب الدخل غير مفعَّل في إعدادات التقييم (شاشة 1)";

    public async Task<ValuationIncomeApproachDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null) return null;
        var entity = await repo.GetAsync(valuationRequestId, cancellationToken);
        var settings = await repo.GetApproachSettingsAsync(valuationRequestId, cancellationToken);
        return ToDto(vr, entity, settings?.IncomeApproachEnabled == true);
    }

    public async Task<(ValuationIncomeApproachDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationIncomeApproachRequest request,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        var blocked = await freeze.GetWriteBlockedMessageAsync(vr, "طلب التقييم مكتمل", cancellationToken);
        if (blocked is not null)
            return (null, new Dictionary<string, string> { ["_"] = blocked });

        // Q-2: the screen is closed while the approach is off (unsaved settings = off).
        var settings = await repo.GetApproachSettingsAsync(valuationRequestId, cancellationToken);
        if (settings?.IncomeApproachEnabled != true)
            return (null, new Dictionary<string, string> { ["_"] = NotEnabledAr });

        var errors = ValuationIncomeApproachRequestRules.Validate(request);
        if (errors.Count > 0) return (null, errors);

        var entity = await repo.FindAsync(valuationRequestId, cancellationToken);
        if (entity is null)
        {
            entity = new ValuationIncomeApproach
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
            };
            await repo.AddAsync(entity, cancellationToken);
        }

        entity.GrossPotentialIncome = request.GrossPotentialIncome;
        entity.VacancyCollectionLossPct = request.VacancyCollectionLossPct;
        entity.OtherIncome = request.OtherIncome;
        entity.OperatingExpensesMode = OperatingExpenseModes.Normalize(request.OperatingExpensesMode);
        entity.OperatingExpensesAmount = request.OperatingExpensesAmount;
        entity.OperatingExpensesPct = request.OperatingExpensesPct;
        entity.CapitalisationRatePct = request.CapitalisationRatePct is { } cap
            ? Math.Round(cap, 4, MidpointRounding.AwayFromZero)
            : null;
        entity.CapRateRationale = string.IsNullOrWhiteSpace(request.CapRateRationale)
            ? null
            : request.CapRateRationale.Trim();
        entity.UpdatedAtUtc = _time.UtcNow();
        await repo.SaveChangesAsync(cancellationToken);

        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    /// <summary>The capitalisation chain from the stored inputs — nothing derived is stored.</summary>
    public static ValuationIncomeApproachDto ToDto(
        ValuationRequest vr,
        ValuationIncomeApproach? entity,
        bool incomeEnabled)
    {
        var gpi = entity?.GrossPotentialIncome ?? 0m;
        var vacancyPct = entity?.VacancyCollectionLossPct ?? 0m;
        var other = entity?.OtherIncome ?? 0m;
        var mode = OperatingExpenseModes.Normalize(entity?.OperatingExpensesMode);
        var egi = IncomeApproachRules.EffectiveGrossIncome(gpi, vacancyPct, other);
        var opex = IncomeApproachRules.OperatingExpenses(
            mode,
            entity?.OperatingExpensesAmount ?? 0m,
            entity?.OperatingExpensesPct ?? 0m,
            egi);
        var noi = IncomeApproachRules.NetOperatingIncome(egi, opex);
        var cap = entity?.CapitalisationRatePct;

        return new ValuationIncomeApproachDto
        {
            ValuationRequestId = vr.Id,
            PropertyId = vr.PropertyId.ToString("D"),
            IsSaved = entity is not null,
            IncomeApproachEnabled = incomeEnabled,
            GrossPotentialIncome = gpi,
            VacancyCollectionLossPct = vacancyPct,
            VacancyLossAmount = IncomeApproachRules.VacancyLoss(gpi, vacancyPct),
            OtherIncome = other,
            EffectiveGrossIncome = egi,
            OperatingExpensesMode = mode,
            OperatingExpensesAmount = entity?.OperatingExpensesAmount ?? 0m,
            OperatingExpensesPct = entity?.OperatingExpensesPct ?? 0m,
            OperatingExpensesTotal = opex,
            OperatingExpensesPctOfEgi = IncomeApproachRules.OperatingExpensesPctOfEgi(opex, egi),
            NetOperatingIncome = noi,
            CapitalisationRatePct = cap,
            CapRateRationale = entity?.CapRateRationale,
            IncomeValue = IncomeApproachRules.CapitalisedValue(noi, cap),
            IsComplete = IncomeApproachRules.IsComplete(gpi, cap, noi),
            UpdatedAtUtc = entity?.UpdatedAtUtc.ToString("o"),
        };
    }
}
