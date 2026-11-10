using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Persistence;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Grey areas 2026-11-10. Fix 2: a property-linked comparable the appraiser removes stays removed for
/// that valuation (it used to come back on the next market read), a comparable linked later still
/// arrives, and the read-time import respects the full write lock (hand-over / review too).
/// Fix 3: the market value is rounded by the request's «تقريب القيمة» setting; the raw value stays.
/// </summary>
public sealed class LinkedComparableDismissalAndMarketRoundingTests
{
    private const string Market = ComparableSelectionContexts.Market;

    // ─── Fix 2 ───

    [Fact]
    public async Task A_removed_linked_comparable_does_not_come_back_on_the_next_read()
    {
        await using var contexts = TestDatabases.Create("linked-dismiss");
        var db = contexts.Valuation;
        var (id, propertyId) = Request(db, "أرض");
        var first = Link(db, propertyId);
        await db.SaveChangesAsync();
        var selections = Service(db);

        Assert.Single((await selections.ListAsync(id, Market))!.Items);
        var (ok, error) = await selections.RemoveAsync(id, first);
        Assert.True(ok, error);

        Assert.Empty((await selections.ListAsync(id, Market))!.Items);
        Assert.Empty((await selections.ListAsync(id, Market))!.Items);
        Assert.Single(db.Set<ValuationDismissedLinkedComparable>().Where(x => x.ValuationRequestId == id));

        // A comparable linked to the property afterwards still arrives, adopted.
        var later = Link(db, propertyId);
        await db.SaveChangesAsync();
        var list = (await selections.ListAsync(id, Market))!;
        var item = Assert.Single(list.Items);
        Assert.Equal(later, item.ComparablePropertyId);
        Assert.True(item.IsAdopted);
    }

    [Fact]
    public async Task Adopting_the_removed_comparable_back_from_the_bank_clears_the_dismissal()
    {
        await using var contexts = TestDatabases.Create("linked-readopt");
        var db = contexts.Valuation;
        var (id, propertyId) = Request(db, "أرض");
        var comp = Link(db, propertyId);
        await db.SaveChangesAsync();
        var selections = Service(db);
        await selections.ListAsync(id, Market);
        await selections.RemoveAsync(id, comp);

        var (row, error) = await selections.SetAdoptedAsync(id, comp, true, "u-1");
        Assert.Null(error);
        Assert.NotNull(row);
        Assert.Empty(db.Set<ValuationDismissedLinkedComparable>().Where(x => x.ValuationRequestId == id));
        Assert.Single((await selections.ListAsync(id, Market))!.Items);
    }

    [Fact]
    public async Task A_linked_comparable_dropped_by_a_list_replace_stays_dropped()
    {
        await using var contexts = TestDatabases.Create("linked-replace");
        var db = contexts.Valuation;
        var (id, propertyId) = Request(db, "أرض");
        Link(db, propertyId);
        await db.SaveChangesAsync();
        var selections = Service(db);
        Assert.Single((await selections.ListAsync(id, Market))!.Items);

        var (after, errors) = await selections.ReplaceAsync(
            id, new ReplaceValuationComparableSelectionsRequest { SelectionContext = Market, Items = [] }, "u-1");

        Assert.Null(errors);
        Assert.Empty(after!.Items);
        Assert.Empty((await selections.ListAsync(id, Market))!.Items);
    }

    [Fact]
    public async Task A_bank_comparable_removed_leaves_no_dismissal_row()
    {
        await using var contexts = TestDatabases.Create("bank-remove");
        var db = contexts.Valuation;
        var (id, _) = Request(db, "أرض");
        var bankComp = Comparable(db);
        await db.SaveChangesAsync();
        var selections = Service(db);
        await selections.SetAdoptedAsync(id, bankComp, true, "u-1");

        await selections.RemoveAsync(id, bankComp);

        Assert.Empty(db.Set<ValuationDismissedLinkedComparable>());
    }

    [Fact]
    public async Task A_request_handed_over_for_review_imports_nothing()
    {
        await using var contexts = TestDatabases.Create("linked-handover");
        var db = contexts.Valuation;
        var (id, propertyId) = Request(db, "أرض");
        Link(db, propertyId);
        await db.SaveChangesAsync();
        // Not deposited (IsFrozen false) but the hand-over lock is on.
        var selections = Service(db, new LockStub(frozen: false, message: "سُلِّمت حزمة التقييم"));

        Assert.Empty((await selections.ListAsync(id, Market))!.Items);
        Assert.Empty(db.ValuationComparableSelections.Where(s => s.ValuationRequestId == id));
    }

    // ─── Fix 3 ───

    [Theory]
    [InlineData(2_217_020.40d, 4, false, true, 2_220_000d)]
    [InlineData(2_217_020.40d, 0, false, true, 2_217_020d)]
    [InlineData(2_217_020.40d, 4, true, true, 2_217_020.40d)]   // land table inside the cost approach: raw
    [InlineData(2_217_020.40d, 4, false, false, 2_217_020.40d)] // deposited request: keeps its figure
    [InlineData(3_200d, 4, false, true, 3_200d)]                // would round to 0 — keeps the raw figure
    public void The_market_value_is_rounded_by_the_request_setting(
        double raw, int decimals, bool landTable, bool round, double expected) =>
        Assert.Equal(
            (decimal)expected,
            ValuationComparableListBuilder.RoundedOpinion((decimal)raw, decimals, landTable, round));

    /// <summary>
    /// The rounded value survives the deposit: only a request flagged by the migration (deposited before the
    /// rounding existed) keeps its raw figure. Fixed 2026-11-10 — the exemption followed the deposit itself,
    /// so a new request deposited at 3,203,000 reconciled at 3,200,000 right after its deposit.
    /// </summary>
    [Fact]
    public async Task The_market_list_keeps_the_rounded_value_after_a_deposit_and_the_raw_one_only_for_flagged_requests()
    {
        await using var contexts = TestDatabases.Create("market-round");
        var db = contexts.Valuation;
        var (id, propertyId) = Request(db, "أرض");
        Link(db, propertyId, area: 731m, price: 1_000_000m);
        db.ValuationMarketApproaches.Add(new ValuationMarketApproach
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            SubjectAreaSqm = 1_621m,
            AdjustmentBasis = MarketAdjustmentBasisKeys.PricePerSqm,
            AnnualMarketRatePct = 0m,
            ValueRoundDecimals = 4,
        });
        await db.SaveChangesAsync();

        var open = (await Service(db).ListAsync(id, Market))!;
        Assert.True(open.MarketOpinionValueRaw > 0m);
        Assert.Equal(MarketOpinionRules.RoundMarketValue(open.MarketOpinionValueRaw, 4), open.MarketOpinionValue);
        Assert.Equal(0m, open.MarketOpinionValue % 10_000m);

        var deposited = (await Service(db, new LockStub(frozen: true, message: "مُودَع")).ListAsync(id, Market))!;
        Assert.Equal(open.MarketOpinionValue, deposited.MarketOpinionValue);

        var header = db.ValuationMarketApproaches.Single(m => m.ValuationRequestId == id);
        header.MarketValueUnrounded = true;
        await db.SaveChangesAsync();
        var legacy = (await Service(db, new LockStub(frozen: true, message: "مُودَع")).ListAsync(id, Market))!;
        Assert.Equal(legacy.MarketOpinionValueRaw, legacy.MarketOpinionValue);
    }

    [Fact]
    public async Task A_deposited_request_without_a_market_header_keeps_the_raw_value()
    {
        await using var contexts = TestDatabases.Create("market-round-noheader");
        var db = contexts.Valuation;
        var (id, propertyId) = Request(db, "أرض");
        Link(db, propertyId, area: 731m, price: 1_000_000m);
        await db.SaveChangesAsync();

        var deposited = (await Service(db, new LockStub(frozen: true, message: "مُودَع")).ListAsync(id, Market))!;

        Assert.Equal(deposited.MarketOpinionValueRaw, deposited.MarketOpinionValue);
    }

    // ─── helpers ───

    private static ValuationComparableSelectionService Service(
        ValuationDbContext db,
        IValuationReportFreezeGate? freeze = null) =>
        new(
            new ValuationComparableSelectionRepository(db),
            freeze ?? new ValuationReportFreezeGate(db),
            ValuationSettingsAndPriorBankFeedTests.Proxy.Of<IOrganizationSettingsService>((method, _) =>
                method.ReturnType == typeof(Task<OrganizationSettingsDto>)
                    ? Task.FromResult(new OrganizationSettingsDto())
                    : null));

    private static (Guid Id, Guid PropertyId) Request(ValuationDbContext db, string propertyType)
    {
        var id = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, $"VR-{Random.Shared.Next(10_000, 99_999)}", propertyId, "الرياض", propertyType, "مقيم",
            "2026-11-10", DateTime.UtcNow));
        return (id, propertyId);
    }

    private static Guid Comparable(ValuationDbContext db, decimal area = 900m, decimal price = 900_000m)
    {
        var compId = Guid.NewGuid();
        db.ComparableProperties.Add(new ComparableProperty
        {
            Id = compId,
            ReferenceCode = $"CMP-{compId.ToString("N")[..8].ToUpperInvariant()}",
            ComparablePropertyType = "أرض",
            TransactionKind = ComparableTransactionKinds.Executed,
            Source = ComparableSources.Other,
            City = "الرياض",
            District = "النرجس",
            AreaSqm = area,
            Price = price,
            PricePerSqm = Math.Round(price / area, 2),
            Latitude = 24.8m,
            Longitude = 46.6m,
            TransactionDate = new DateOnly(2026, 10, 1),
            IsActive = true,
        });
        return compId;
    }

    private static Guid Link(ValuationDbContext db, Guid propertyId, decimal area = 900m, decimal price = 900_000m)
    {
        var compId = Comparable(db, area, price);
        db.PropertyComparableLinks.Add(new PropertyComparableLink
        {
            Id = Guid.NewGuid(),
            PropertyId = propertyId,
            ComparablePropertyId = compId,
            LinkedAtUtc = DateTime.UtcNow,
        });
        return compId;
    }

    /// <summary>Deposit layer (<paramref name="frozen"/>) and the full write lock (<paramref name="message"/>).</summary>
    private sealed class LockStub(bool frozen, string? message) : IValuationReportFreezeGate
    {
        public Task<bool> IsFrozenAsync(Guid valuationRequestId, CancellationToken cancellationToken = default) =>
            Task.FromResult(frozen);

        public Task<string?> GetFrozenMessageAsync(
            Guid valuationRequestId, Guid propertyId, CancellationToken cancellationToken = default) =>
            Task.FromResult(message);
    }
}
