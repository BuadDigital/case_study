using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>Q-8: Justification Engineering — Agent-level justification + minimum length.</summary>
public class AdjustmentFactorRationaleTests
{
    [Fact]
    public void Justification_min_length_is_ten_and_trims()
    {
        Assert.False(JustificationRules.IsAcceptable(null));
        Assert.False(JustificationRules.IsAcceptable("   "));
        Assert.False(JustificationRules.IsAcceptable("."));
        Assert.False(JustificationRules.IsAcceptable("123456789"));
        Assert.False(JustificationRules.IsAcceptable("  123456789  "));
        Assert.True(JustificationRules.IsAcceptable("1234567890"));
        Assert.True(JustificationRules.IsAcceptable("مبرر جوهري كافٍ"));

        Assert.False(JustificationRules.IsTooShort(""));
        Assert.True(JustificationRules.IsTooShort("قصير"));
        Assert.False(JustificationRules.IsTooShort("مبرر جوهري كافٍ"));
    }

    [Fact]
    public void Sham_rationale_does_not_resolve_a_rationale_alert()
    {
        var resolutions = new Dictionary<string, ValuationMethodologyAlertResolution>(
            StringComparer.OrdinalIgnoreCase)
        {
            [ValuationMethodologyAlertCodes.LargeAdjustments] =
                new(ValuationMethodologyAlertCodes.LargeAdjustments, "."),
        };

        Assert.False(ValuationMethodologyAlertRules.IsResolved(
            17, ValuationMethodologyAlertCodes.LargeAdjustments, resolutions));

        resolutions[ValuationMethodologyAlertCodes.LargeAdjustments] =
            new(ValuationMethodologyAlertCodes.LargeAdjustments,
                "تجاوز التسويات مبرر بندرة المقارنات في الحي");
        Assert.True(ValuationMethodologyAlertRules.IsResolved(
            17, ValuationMethodologyAlertCodes.LargeAdjustments, resolutions));
    }

    [Fact]
    public void Line_override_wins_and_blank_inherits_the_factor_rationale()
    {
        Assert.Equal(
            "مبرر العامل",
            MarketApproachRules.EffectiveRationale("", "مبرر العامل"));
        Assert.Equal(
            "مبرر العامل",
            MarketApproachRules.EffectiveRationale("   ", "مبرر العامل"));
        Assert.Equal(
            "تخصيص المقارن",
            MarketApproachRules.EffectiveRationale("تخصيص المقارن", "مبرر العامل"));
        Assert.Equal("", MarketApproachRules.EffectiveRationale(null, null));
    }

    [Fact]
    public async Task Save_factor_rationale_upserts_clears_and_rejects_short_text()
    {
        await using var contexts = TestDatabases.Create("factor-rationale");
        var db = contexts.Valuation;
        var id = Guid.Parse("b2000001-0000-4000-8000-000000000001");
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, "VR-800", Guid.NewGuid().ToString(), "جدة", "فيلا", "مقيم",
            "2026-06-25", DateTime.UtcNow));
        await db.SaveChangesAsync();

        var service = new ValuationComparableSelectionService(
            db, new StubOrganizationSettings());

        // Too short — rejected (Q-8-2).
        var (_, shortErrors) = await service.SaveFactorRationaleAsync(
            id,
            new SaveAdjustmentFactorRationaleRequest
            {
                SelectionContext = "market",
                FactorKey = "financing",
                RationaleAr = "قصير",
            },
            "user-1");
        Assert.NotNull(shortErrors);
        Assert.Contains("rationaleAr", shortErrors!.Keys);

        // Save properly and then update.
        var (saved, saveErrors) = await service.SaveFactorRationaleAsync(
            id,
            new SaveAdjustmentFactorRationaleRequest
            {
                SelectionContext = "market",
                FactorKey = "financing",
                RationaleAr = "شروط التمويل مماثلة لكل المقارنات",
            },
            "user-1");
        Assert.Null(saveErrors);
        Assert.Equal("شروط التمويل مماثلة لكل المقارنات", saved!.RationaleAr);
        Assert.Single(db.ValuationAdjustmentFactorRationales);

        var (updated, _) = await service.SaveFactorRationaleAsync(
            id,
            new SaveAdjustmentFactorRationaleRequest
            {
                SelectionContext = "market",
                FactorKey = "financing",
                RationaleAr = "مبرر محدّث بعد مراجعة الصفقات",
            },
            "user-2");
        Assert.Equal("مبرر محدّث بعد مراجعة الصفقات", updated!.RationaleAr);
        Assert.Single(db.ValuationAdjustmentFactorRationales);

        // Empty erase.
        var (cleared, clearErrors) = await service.SaveFactorRationaleAsync(
            id,
            new SaveAdjustmentFactorRationaleRequest
            {
                SelectionContext = "market",
                FactorKey = "financing",
                RationaleAr = "",
            },
            "user-1");
        Assert.Null(clearErrors);
        Assert.Equal("", cleared!.RationaleAr);
        Assert.Empty(db.ValuationAdjustmentFactorRationales);
    }

    [Fact]
    public async Task List_returns_factor_rationales_for_the_requested_context()
    {
        await using var contexts = TestDatabases.Create("factor-rationale-list");
        var db = contexts.Valuation;
        var id = Guid.Parse("b2000002-0000-4000-8000-000000000002");
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, "VR-801", Guid.NewGuid().ToString(), "جدة", "فيلا", "مقيم",
            "2026-06-25", DateTime.UtcNow));
        db.ValuationAdjustmentFactorRationales.Add(new ValuationAdjustmentFactorRationale
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            SelectionContext = "market",
            FactorKey = "location",
            RationaleAr = "الموقع أدنى من العقار محل التقييم",
        });
        await db.SaveChangesAsync();

        var service = new ValuationComparableSelectionService(
            db, new StubOrganizationSettings());
        var list = await service.ListAsync(id, "market");

        Assert.NotNull(list);
        var rationale = Assert.Single(list!.FactorRationales);
        Assert.Equal("location", rationale.FactorKey);
        Assert.Equal("الموقع أدنى من العقار محل التقييم", rationale.RationaleAr);
    }

    private sealed class StubOrganizationSettings : IOrganizationSettingsService
    {
        public Task<OrganizationSettingsDto> GetAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());

        public Task<OrganizationSettingsDto> GetInternalAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());

        public Task<OrganizationSettingsDto> SaveAsync(
            SaveOrganizationSettingsRequest request,
            string actorId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());
    }
}
