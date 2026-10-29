using System.Reflection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// On the approach-settings save, on the prior-valuation bank feed.
/// </summary>
public class ValuationSettingsAndPriorBankFeedTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 25, 9, 0, 0, TimeSpan.Zero);
    private const string Rationale = "تاريخ وفاة المورث وفق صك حصر الورثة";

    // ---- approach settings ----

    [Fact]
    public async Task A_retrospective_date_after_today_or_without_rationale_is_refused()
    {
        await using var contexts = TestDatabases.Create("settings-retro");
        var (service, id) = await ArrangeSettingsAsync(contexts.Valuation);

        var (_, future) = await service.SaveAsync(id, Retrospective("2026-10-26", Rationale));
        Assert.Contains("retrospectiveDate", future!.Keys);

        var (_, blank) = await service.SaveAsync(id, Retrospective("2026-02-25", ""));
        Assert.Contains("retrospectiveRationale", blank!.Keys);

        var (saved, errors) = await service.SaveAsync(id, Retrospective("2026-02-25", Rationale));
        Assert.Null(errors);
        Assert.Equal(Rationale, saved!.RetrospectiveRationale);
    }

    [Fact]
    public async Task A_client_that_does_not_send_the_rationale_keeps_the_stored_one()
    {
        await using var contexts = TestDatabases.Create("settings-retro-keep");
        var (service, id) = await ArrangeSettingsAsync(contexts.Valuation);
        await service.SaveAsync(id, Retrospective("2026-02-25", Rationale));

        // The final-review assumptions save sends retrospectiveRationale: null.
        var (saved, errors) = await service.SaveAsync(id, Retrospective("2026-02-25", null));

        Assert.Null(errors);
        Assert.Equal(Rationale, saved!.RetrospectiveRationale);
    }

    [Fact]
    public async Task The_income_approach_is_refused_and_a_leasehold_interest_is_saved()
    {
        await using var contexts = TestDatabases.Create("settings-income-lease");
        var (service, id) = await ArrangeSettingsAsync(contexts.Valuation);

        // The income approach is not available yet — enabling it is a field error.
        var (refused, incomeErrors) = await service.SaveAsync(id, Request() with { IncomeApproachEnabled = true });
        Assert.Null(refused);
        Assert.Equal("أسلوب الدخل قيد الإنشاء — مؤجَّل رسمياً", incomeErrors!["incomeApproachEnabled"]);

        var (_, missingYears) = await service.SaveAsync(id, Request() with
        {
            OwnershipInterestKey = OwnershipInterestKeys.LeasedLand,
        });
        Assert.Contains("remainingLeaseYears", missingYears!.Keys);

        var (saved, errors) = await service.SaveAsync(id, Request() with
        {
            OwnershipInterestKey = OwnershipInterestKeys.LeasedLand,
            RemainingLeaseYears = 4,
        });
        Assert.Null(errors);
        Assert.False(saved!.IncomeApproachEnabled);
        Assert.Equal(OwnershipInterestKeys.LeasedLand, saved.OwnershipInterestKey);
        Assert.Equal("أرض مستأجرة", saved.OwnershipInterestLabelAr);
        Assert.Equal(4m, saved.RemainingLeaseYears);

        // An older screen that does not know the field keeps the stored interest.
        var (kept, _) = await service.SaveAsync(id, Request());
        Assert.Equal(OwnershipInterestKeys.LeasedLand, kept!.OwnershipInterestKey);
        Assert.Equal(4m, kept.RemainingLeaseYears);

        // Back to full ownership drops the lease term.
        var (freehold, _) = await service.SaveAsync(id, Request() with
        {
            OwnershipInterestKey = OwnershipInterestKeys.Freehold,
            RemainingLeaseYears = 4,
        });
        Assert.Null(freehold!.RemainingLeaseYears);
    }

    private static async Task<(ValuationApproachSettingsService Service, Guid Id)> ArrangeSettingsAsync(
        ValuationDbContext db)
    {
        var id = NewRequest(db, Guid.NewGuid());
        await db.SaveChangesAsync();
        var lookup = Proxy.Of<ICaseStudyLookup>((_, _) => null);
        var organization = Proxy.Of<IOrganizationSettingsService>((method, _) =>
            method.Name == nameof(IOrganizationSettingsService.GetInternalAsync)
                ? Task.FromResult(new OrganizationSettingsDto())
                : null);
        var lists = Proxy.Of<IValuationListsService>((method, _) =>
            method.Name == nameof(IValuationListsService.GetAsync) ? Task.FromResult(new ValuationListsDto()) : null);
        return (new ValuationApproachSettingsService(db, lookup, organization, lists, new FixedClock(Now)), id);
    }

    private static SettingsRequest Request() => new();

    private static SettingsRequest Retrospective(string date, string? rationale) => new()
    {
        ValuationDateMode = ValuationDateModes.Retrospective,
        RetrospectiveDate = date,
        RetrospectiveRationale = rationale,
    };

    /// <summary>The settings body with a mutable copy (<c>with</c>) — the DTO itself is init-only.</summary>
    private sealed record SettingsRequest
    {
        public bool IncomeApproachEnabled { get; init; }
        public string? ValuationDateMode { get; init; }
        public string? RetrospectiveDate { get; init; }
        public string? RetrospectiveRationale { get; init; }
        public string? OwnershipInterestKey { get; init; }
        public decimal? RemainingLeaseYears { get; init; }

        public static implicit operator SaveValuationApproachSettingsRequest(SettingsRequest r) => new()
        {
            MarketApproachEnabled = true,
            CostApproachEnabled = true,
            IncomeApproachEnabled = r.IncomeApproachEnabled,
            CostScopeKey = CostScopeKeys.LandAndBuilding,
            ValuationPurposeKey = ValuationPurposeKeys.JudicialExecution,
            ValuationDateMode = r.ValuationDateMode,
            RetrospectiveDate = r.RetrospectiveDate,
            RetrospectiveRationale = r.RetrospectiveRationale,
            OwnershipInterestKey = r.OwnershipInterestKey,
            RemainingLeaseYears = r.RemainingLeaseYears,
        };
    }

    // ----: prior-valuation bank feed ----

    [Theory]
    [InlineData("market", "land_and_building", "issue", true)]
    [InlineData("liquidation", "land_and_building", "issue", false)]
    [InlineData("market", "building_only", "issue", false)]
    [InlineData("market", "land_only", "issue", true)]
    [InlineData("market", "land_only", "retrospective", false)]
    [InlineData("liquidation", "land_only", "issue", false)]
    [InlineData("market", "land_and_building", "retrospective", false)]
    [InlineData("market", "", "issue", false)]
    public void Only_a_current_market_value_of_land_with_or_without_buildings_feeds_the_bank(
        string basis, string scope, string dateMode, bool feeds) =>
        Assert.Equal(feeds, PriorValuationBankRules.Qualifies(basis, scope, dateMode));

    [Fact]
    public async Task A_land_only_valuation_enters_the_bank_as_a_land_comparable()
    {
        Assert.Equal("أرض", PriorValuationBankRules.ComparableType(CostScopeKeys.LandOnly, "فيلا"));
        Assert.Equal("فيلا", PriorValuationBankRules.ComparableType(CostScopeKeys.LandAndBuilding, "فيلا"));

        await using var contexts = TestDatabases.Create("prior-bank-land");
        var db = contexts.Valuation;
        var propertyId = Guid.NewGuid();
        var id = NewRequest(db, propertyId);
        db.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            CostScopeKey = CostScopeKeys.LandOnly,
            ValuationPurposeKey = ValuationPurposeKeys.SalePurchase,
        });
        await db.SaveChangesAsync();

        Assert.True(await Feeder(db, () => 900_000m, () => BasisOfValueKeys.Market).FeedAsync(id));

        db.ChangeTracker.Clear();
        var row = Assert.Single(db.ComparableProperties.Where(c => c.SourcePropertyId == propertyId));
        Assert.Equal("أرض", row.ComparablePropertyType);
        Assert.Equal(ComparableSources.PriorValuation, row.Source);
        Assert.True(row.IsActive);
    }

    [Fact]
    public async Task A_new_deposited_version_updates_the_one_bank_row_and_a_non_qualifying_one_retires_it()
    {
        await using var contexts = TestDatabases.Create("prior-bank-feed");
        var db = contexts.Valuation;
        var propertyId = Guid.NewGuid();
        var id = NewRequest(db, propertyId);
        db.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            CostScopeKey = CostScopeKeys.LandAndBuilding,
            ValuationPurposeKey = ValuationPurposeKeys.SalePurchase,
        });
        await db.SaveChangesAsync();
        var final = 1_000_000m;
        var basis = BasisOfValueKeys.Market;
        var feeder = Feeder(db, () => final, () => basis);

        Assert.True(await feeder.FeedAsync(id));
        final = 1_200_000m;
        Assert.True(await feeder.FeedAsync(id));

        db.ChangeTracker.Clear();
        var row = Assert.Single(db.ComparableProperties.Where(c => c.SourcePropertyId == propertyId));
        Assert.Equal(1_200_000m, row.Price);
        Assert.Equal(2_400m, row.PricePerSqm);
        Assert.True(row.IsActive);

        basis = BasisOfValueKeys.Liquidation;
        Assert.False(await feeder.FeedAsync(id));
        db.ChangeTracker.Clear();
        Assert.False(Assert.Single(db.ComparableProperties.Where(c => c.SourcePropertyId == propertyId)).IsActive);
    }

    [Fact]
    public async Task A_bank_row_another_valuation_adopted_is_never_rewritten()
    {
        await using var contexts = TestDatabases.Create("prior-bank-adopted");
        var db = contexts.Valuation;
        var propertyId = Guid.NewGuid();
        var id = NewRequest(db, propertyId);
        var other = NewRequest(db, Guid.NewGuid());
        db.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            CostScopeKey = CostScopeKeys.LandAndBuilding,
            ValuationPurposeKey = ValuationPurposeKeys.SalePurchase,
        });
        await db.SaveChangesAsync();
        var final = 1_000_000m;
        var feeder = Feeder(db, () => final, () => BasisOfValueKeys.Market);
        Assert.True(await feeder.FeedAsync(id));
        var rowId = db.ComparableProperties.Single(c => c.SourcePropertyId == propertyId).Id;
        db.ValuationComparableSelections.Add(new ValuationComparableSelection
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = other,
            ComparablePropertyId = rowId,
            IsAdopted = true,
            SelectedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        final = 1_500_000m;
        Assert.False(await feeder.FeedAsync(id));

        db.ChangeTracker.Clear();
        Assert.Equal(1_000_000m, db.ComparableProperties.Single(c => c.Id == rowId).Price);
    }

    private static PriorValuationBankFeeder Feeder(ValuationDbContext db, Func<decimal> final, Func<string> basis)
    {
        var lookup = Proxy.Of<ICaseStudyLookup>((method, _) =>
            method.Name == nameof(ICaseStudyLookup.GetValuationPropertyContextAsync)
                ? Task.FromResult<CaseStudyValuationPropertyContextDto?>(new CaseStudyValuationPropertyContextDto
                {
                    PoNumber = "PO-1",
                    City = "الرياض",
                    District = "النرجس",
                    PropertyType = "فيلا",
                    LatestWorkspace = new CaseStudyInspectionWorkspaceDto { MapLatitude = 24.8m, MapLongitude = 46.6m },
                })
                : null);
        var reconciliation = Proxy.Of<IValuationReconciliationService>((method, _) =>
            method.Name == nameof(IValuationReconciliationService.GetAsync)
                ? Task.FromResult<ValuationReconciliationDto?>(new ValuationReconciliationDto
                {
                    FinalOpinionValue = final(),
                    BasisOfValueKey = basis(),
                })
                : null);
        var selections = Proxy.Of<IValuationComparableSelectionService>((method, args) =>
            method.Name == nameof(IValuationComparableSelectionService.ListAsync) && args?.Length == 2
                ? Task.FromResult<ValuationComparableSelectionListDto?>(new ValuationComparableSelectionListDto
                {
                    SubjectAreaSqm = 500m,
                })
                : null);
        return new PriorValuationBankFeeder(db, lookup, reconciliation, selections, new FixedClock(Now));
    }

    private static Guid NewRequest(ValuationDbContext db, Guid propertyId)
    {
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, $"VR-{Random.Shared.Next(10_000, 99_999)}", propertyId, "الرياض", "فيلا", "مقيم",
            "2026-10-01", DateTime.UtcNow));
        return id;
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    /// <summary>
    /// Interface stand-in: the answer function returns the result for a call, or null to answer with the
    /// return type's default (a completed task of <c>default</c>).
    /// </summary>
    public class Proxy : DispatchProxy
    {
        private Func<MethodInfo, object?[]?, object?> _answer = (_, _) => null;

        public static T Of<T>(Func<MethodInfo, object?[]?, object?> answer)
            where T : class
        {
            var proxy = Create<T, Proxy>();
            ((Proxy)(object)proxy)._answer = answer;
            return proxy;
        }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            var method = targetMethod!;
            var answered = _answer(method, args);
            if (answered is not null) return answered;

            var returnType = method.ReturnType;
            if (returnType == typeof(Task)) return Task.CompletedTask;
            if (!returnType.IsGenericType || returnType.GetGenericTypeDefinition() != typeof(Task<>))
                return null;
            var resultType = returnType.GetGenericArguments()[0];
            var value = resultType.IsValueType ? Activator.CreateInstance(resultType) : null;
            return typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(resultType)
                .Invoke(null, [value]);
        }
    }
}
