using System.Reflection;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Persistence;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// D3 — a 0 «خصم التصفية» is valid on every basis but «قيمة التصفية», where the reconciliation SAVE
/// refuses it (not the hand-over). Problem 20 — the alert dispositions save on their own, without
/// the methods rationale the full save requires.
/// </summary>
public class ValuationReconciliationSaveRulesTests
{
    [Fact]
    public async Task A_zero_discount_on_the_liquidation_basis_is_refused_at_save_with_one_name()
    {
        await using var rig = Arrange("recon-d3-liq-zero");

        var (result, errors) = await rig.Service.SaveAsync(rig.RequestId, Request("liquidation", 0m));

        Assert.Null(result);
        Assert.Equal(ReconciliationLiquidationMessages.RequiredForLiquidationAr, errors!["liquidationDiscountPct"]);
        Assert.Contains("خصم التصفية", errors["liquidationDiscountPct"]);
        Assert.False(await rig.Contexts.Valuation.ValuationReconciliations.AnyAsync());
    }

    [Theory]
    [InlineData("market")]
    [InlineData("investment")]
    public async Task A_zero_discount_is_valid_when_the_basis_is_not_liquidation(string basis)
    {
        await using var rig = Arrange($"recon-d3-{basis}");

        var (result, errors) = await rig.Service.SaveAsync(rig.RequestId, Request(basis, 0m));

        Assert.Null(errors);
        Assert.False(result!.LiquidationDiscountApplied);
    }

    [Fact]
    public async Task A_positive_discount_with_its_rationale_saves_on_the_liquidation_basis()
    {
        await using var rig = Arrange("recon-d3-liq-ok");

        var (result, errors) = await rig.Service.SaveAsync(
            rig.RequestId, Request("liquidation", 10m, "بيع بالمزاد خلال مدة تسويق قصيرة"));

        Assert.Null(errors);
        Assert.Equal(10m, result!.LiquidationDiscountPct);
    }

    [Fact]
    public async Task Every_liquidation_message_uses_the_name_khasm_al_tasfiya()
    {
        await using var rig = Arrange("recon-d3-names");

        var (_, onMarket) = await rig.Service.SaveAsync(rig.RequestId, Request("market", 5m, "سبب"));
        var (_, noRationale) = await rig.Service.SaveAsync(rig.RequestId, Request("liquidation", 5m));
        var (_, outOfRange) = await rig.Service.SaveAsync(rig.RequestId, Request("liquidation", 120m, "سبب"));

        Assert.Contains("خصم التصفية", onMarket!["liquidationDiscountPct"]);
        Assert.Contains("خصم التصفية", noRationale!["liquidationDiscountRationale"]);
        Assert.Contains("خصم التصفية", outOfRange!["liquidationDiscountPct"]);
        Assert.DoesNotContain("معامل", noRationale["liquidationDiscountRationale"]);
    }

    [Fact]
    public async Task Alert_dispositions_save_without_any_methods_rationale()
    {
        await using var rig = Arrange("recon-overrides-alone");

        var (result, errors) = await rig.Service.SaveAlertOverridesAsync(
            rig.RequestId,
            new SaveValuationAlertOverridesRequest
            {
                MethodologyAlertOverrides =
                [
                    new ValuationMethodologyAlertOverrideDto { Code = "m7", Acknowledged = true },
                    new ValuationMethodologyAlertOverrideDto { Code = "m12", OverrideRationale = "  مبرر مكتوب  " },
                ],
            },
            actorId: "appraiser-1");

        Assert.Null(errors);
        Assert.Equal("", result!.MethodsRationale);
        Assert.Contains(result.MethodologyAlertOverrides, o => o.Code == "m7" && o.Acknowledged);
        Assert.Contains(result.MethodologyAlertOverrides, o => o.Code == "m12" && o.OverrideRationale == "مبرر مكتوب");
        Assert.Single(rig.Audit.Entries);
    }

    [Fact]
    public async Task Saving_one_disposition_keeps_the_others_and_leaves_the_reconciliation_alone()
    {
        await using var rig = Arrange("recon-overrides-merge");
        var (_, saveErrors) = await rig.Service.SaveAsync(
            rig.RequestId, Request("market", 0m, overrides: [new ValuationMethodologyAlertOverrideDto { Code = "m7", Acknowledged = true }]));
        Assert.Null(saveErrors);

        var (result, errors) = await rig.Service.SaveAlertOverridesAsync(
            rig.RequestId,
            new SaveValuationAlertOverridesRequest
            {
                MethodologyAlertOverrides = [new ValuationMethodologyAlertOverrideDto { Code = "m12", Acknowledged = true }],
            });

        Assert.Null(errors);
        Assert.Equal("مبرر الترجيح", result!.MethodsRationale);
        Assert.Equal(["m12", "m7"], result.MethodologyAlertOverrides.Select(o => o.Code).Order().ToArray());
    }

    [Fact]
    public void An_emptied_disposition_is_dropped_from_the_merge()
    {
        var merged = ValuationReconciliationService.MergeAlertOverrides(
            [new ValuationMethodologyAlertOverrideDto { Code = "m7", Acknowledged = true }],
            [new ValuationMethodologyAlertOverrideDto { Code = "M7", Acknowledged = false }]);

        Assert.Empty(merged);
    }

    // ---- arrangement ----

    private static SaveValuationReconciliationRequest Request(
        string basis,
        decimal discountPct,
        string? discountRationale = null,
        IReadOnlyList<ValuationMethodologyAlertOverrideDto>? overrides = null) => new()
    {
        MethodologyAlertOverrides = overrides,
        Methods = [new SaveValuationReconciliationMethodRequest { ApproachKind = ValuationApproachKinds.Market, WeightPct = 100m }],
        MethodsRationale = "مبرر الترجيح",
        BasisOfValueKey = basis,
        LiquidationDiscountPct = discountPct,
        LiquidationDiscountRationale = discountRationale,
    };

    private static Rig Arrange(string name)
    {
        var contexts = TestDatabases.Create(name);
        var id = Guid.NewGuid();
        contexts.Valuation.ValuationRequests.Add(ValuationRequest.Create(
            id, "VR-" + name, Guid.NewGuid(), "جدة", "فيلا", "مقيم", "2026-06-25", DateTime.UtcNow));
        contexts.Valuation.SaveChanges();
        var audit = new RecordingAuditLogAppend();
        var service = new ValuationReconciliationService(
            new ValuationReconciliationRepository(contexts.Valuation),
            new ValuationReportFreezeGate(contexts.Valuation),
            NullAnswers.Create<ICaseStudyLookup>(),
            new AuditLogWriter(),
            audit,
            NullAnswers.Create<IValuationComparableSelectionService>(),
            NullAnswers.Create<IValuationCostApproachService>(),
            NullAnswers.Create<IValuationIncomeApproachService>());
        return new Rig(contexts, service, id, audit);
    }

    private sealed class Rig(
        TestDatabases.ContextSet contexts,
        ValuationReconciliationService service,
        Guid requestId,
        RecordingAuditLogAppend audit) : IAsyncDisposable
    {
        public TestDatabases.ContextSet Contexts { get; } = contexts;
        public ValuationReconciliationService Service { get; } = service;
        public Guid RequestId { get; } = requestId;
        public RecordingAuditLogAppend Audit { get; } = audit;
        public ValueTask DisposeAsync() => Contexts.DisposeAsync();
    }

    /// <summary>Every async read answers «nothing there» (null / empty) — the save rules under test need no lookups.</summary>
    private class NullAnswers : DispatchProxy
    {
        public static T Create<T>() where T : class => DispatchProxy.Create<T, NullAnswers>();

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            var type = targetMethod!.ReturnType;
            if (type == typeof(Task)) return Task.CompletedTask;
            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Task<>))
            {
                var inner = type.GetGenericArguments()[0];
                var value = inner.IsValueType ? Activator.CreateInstance(inner) : EmptyListOrNull(inner);
                return typeof(Task).GetMethod(nameof(Task.FromResult))!.MakeGenericMethod(inner).Invoke(null, [value]);
            }
            throw new NotSupportedException(targetMethod.Name);
        }

        private static object? EmptyListOrNull(Type type) =>
            type.IsGenericType && type.GetGenericTypeDefinition() == typeof(IReadOnlyList<>)
                ? Array.CreateInstance(type.GetGenericArguments()[0], 0)
                : null;
    }
}
