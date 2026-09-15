using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Data;

/// <summary>
/// Demo comparable-property rows from docs/_similar-sales-valuation.
/// Bank rows may exist for local demo; valuations never auto-attach or auto-adopt them.
/// </summary>
public static class ComparableBankSeed
{
    public static readonly Guid[] SeedIds = DemoComparableBank.Ids;

    private sealed record BankRow(
        Guid Id,
        string Ref,
        string Kind, // executed | offer
        string PriceDesc, // "" | asking | som
        string Date,
        decimal PricePerSqm,
        decimal Area,
        string District,
        string Source,
        string Intake,
        string PropType,
        bool AdoptDefault,
        // compSpec — comparable descriptions per difference factor (from interactive-model bank).
        string SpecIdeal,
        string SpecAttraction,
        string SpecAccess,
        string SpecStreetsCount,
        string SpecStreetsLength);

    // Same data from docs/_similar-sales-valuation (v2 dc.html — BANK + BUILT).
    private static readonly BankRow[] Rows =
    [
        new(SeedIds[0], "TRX-24-0912", ComparableTransactionKinds.Executed, "", "2025-11-14",
            2450, 800, "النرجس", ComparableSources.Field, ComparableIntakeChannels.Field,
            "أرض سكنية", true,
            "٨٠٠ م²", "٩٠٠م من مركز تجاري", "داخل الحي", "شارعان (زاوية)", "٢٠م · ١٥م"),
        new(SeedIds[1], "TRX-24-1077", ComparableTransactionKinds.Executed, "", "2025-08-02",
            2310, 600, "النرجس", ComparableSources.Field, ComparableIntakeChannels.Field,
            "أرض سكنية", true,
            "٦٠٠ م²", "١٫٤كم من مركز تجاري", "عمق الحي", "شارع واحد", "١٥م"),
        new(SeedIds[2], "TRX-25-0143", ComparableTransactionKinds.Executed, "", "2026-01-21",
            2620, 1050, "الياسمين", ComparableSources.ListingPlatform, ComparableIntakeChannels.Office,
            "أرض سكنية", true,
            "١٠٥٠ م²", "٤٠٠م من مركز تجاري", "قرب مدخل رئيسي", "شارعان (زاوية)", "٣٠م · ١٥م"),
        new(SeedIds[3], "OFR-25-0206", ComparableTransactionKinds.Offer, "", "2026-03-09",
            2780, 960, "النرجس", ComparableSources.ListingPlatform, ComparableIntakeChannels.Office,
            "أرض سكنية", true,
            "٩٦٠ م²", "٦٠٠م من مركز تجاري", "على طريق رئيسي", "ثلاثة شوارع", "٣٠م · ٢٠م · ١٥م"),
        new(SeedIds[4], "TRX-25-0288", ComparableTransactionKinds.Executed, "", "2026-02-02",
            2515, 1200, "الياسمين", ComparableSources.PriorValuation, ComparableIntakeChannels.Office,
            "أرض سكنية", false,
            "١٢٠٠ م²", "١كم من مركز تجاري", "أطراف الحي", "شارع واحد", "٢٠م"),
        new(SeedIds[5], "BID-25-0031", ComparableTransactionKinds.Offer, ComparablePriceDescriptions.Som, "2026-04-18",
            2180, 750, "العارض", ComparableSources.Field, ComparableIntakeChannels.Field,
            "أرض تجارية", false,
            "٧٥٠ م²", "٢٫٢كم من مركز تجاري", "عمق الحي", "شارع واحد", "١٥م"),
        new(SeedIds[6], "TRX-24-0655", ComparableTransactionKinds.Executed, "", "2025-04-27",
            2050, 200, "العارض", ComparableSources.PriorValuation, ComparableIntakeChannels.Office,
            "أرض سكنية", false,
            "٢٠٠ م²", "٢كم من مركز تجاري", "أطراف الحي", "شارع واحد", "١٢م"),
        // BUILT — villas
        new(SeedIds[7], "TRX-25-0451", ComparableTransactionKinds.Executed, "", "2026-02-11",
            4150, 520, "النرجس", ComparableSources.Field, ComparableIntakeChannels.Field,
            "فيلا سكنية", false,
            "٥٢٠ م² بناء", "٧٠٠م من مركز تجاري", "داخل الحي", "شارع واحد", "٢٠م"),
        new(SeedIds[8], "TRX-25-0508", ComparableTransactionKinds.Executed, "", "2025-12-03",
            3980, 610, "النرجس", ComparableSources.ListingPlatform, ComparableIntakeChannels.Office,
            "فيلا سكنية", false,
            "٦١٠ م² بناء", "١٫٢كم من مركز تجاري", "عمق الحي", "شارعان (زاوية)", "٢٠م · ١٥م"),
        new(SeedIds[9], "OFR-26-0033", ComparableTransactionKinds.Offer, "", "2026-04-22",
            4380, 480, "الياسمين", ComparableSources.ListingPlatform, ComparableIntakeChannels.Office,
            "فيلا سكنية", false,
            "٤٨٠ م² بناء", "٤٠٠م من مركز تجاري", "قرب مدخل رئيسي", "شارعان (زاوية)", "٣٠م · ١٥م"),
        new(SeedIds[10], "TRX-25-0602", ComparableTransactionKinds.Executed, "", "2025-09-18",
            3720, 700, "العارض", ComparableSources.PriorValuation, ComparableIntakeChannels.Office,
            "فيلا سكنية", false,
            "٧٠٠ م² بناء", "٢كم من مركز تجاري", "أطراف الحي", "شارع واحد", "١٥م"),
        // apartments
        new(SeedIds[11], "TRX-25-0771", ComparableTransactionKinds.Executed, "", "2026-01-09",
            5100, 175, "النرجس", ComparableSources.Field, ComparableIntakeChannels.Field,
            "شقة سكنية", false,
            "١٧٥ م²", "٦٠٠م من مركز تجاري", "داخل الحي", "واجهة واحدة", "٢٠م"),
        new(SeedIds[12], "TRX-25-0803", ComparableTransactionKinds.Executed, "", "2025-10-27",
            4870, 195, "النرجس", ComparableSources.ListingPlatform, ComparableIntakeChannels.Office,
            "شقة سكنية", false,
            "١٩٥ م²", "١كم من مركز تجاري", "عمق الحي", "واجهة واحدة", "١٥م"),
        new(SeedIds[13], "OFR-26-0091", ComparableTransactionKinds.Offer, "", "2026-05-14",
            5340, 160, "الياسمين", ComparableSources.ListingPlatform, ComparableIntakeChannels.Office,
            "شقة سكنية", false,
            "١٦٠ م²", "٣٥٠م من مركز تجاري", "قرب مدخل رئيسي", "واجهتان", "٣٠م · ١٥م"),
    ];

    public static async Task EnsureAsync(
        ValuationDbContext db,
        CancellationToken cancellationToken = default,
        TimeProvider? time = null)
    {
 // B8: wall clock only via TimeProvider — the seed lives beside runtime code now.
        var now = (time ?? TimeProvider.System).GetUtcNow().UtcDateTime;
        await EnsureBankRowsAsync(db, now, cancellationToken);
    }

    /// <summary>
    /// Drops demo-bank selections the valuer never adopted, and clears the fake
    /// field-comparable pin so they do not re-import onto a valuation.
    /// </summary>
    public static async Task DetachUnchosenFromValuationAsync(
        ValuationDbContext db,
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var seedIds = DemoComparableBank.Ids;
        var rows = await db.ValuationComparableSelections
            .Where(s =>
                s.ValuationRequestId == valuationRequestId
                && seedIds.Contains(s.ComparablePropertyId))
            .ToListAsync(cancellationToken);

        var unchosen = rows.Where(DemoComparableBank.IsUnchosenDemoSelection).ToList();
        if (unchosen.Count > 0)
            db.ValuationComparableSelections.RemoveRange(unchosen);

        var pinned = await db.ComparableProperties
            .Where(c =>
                seedIds.Contains(c.Id)
                && c.SourceWorkOrderNumber == "SEED-FIELD")
            .ToListAsync(cancellationToken);
        foreach (var comp in pinned)
        {
            comp.SourceWorkOrderNumber = null;
            comp.SourcePropertyId = null;
        }

        if (unchosen.Count > 0 || pinned.Count > 0)
            await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureBankRowsAsync(
        ValuationDbContext db,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var refs = Rows.Select(r => r.Ref).ToArray();
        var existing = await db.ComparableProperties
            .Where(c => refs.Contains(c.ReferenceCode))
            .ToDictionaryAsync(c => c.ReferenceCode, cancellationToken);

        var latBase = 24.8250m;
        var lngBase = 46.6550m;
        for (var i = 0; i < Rows.Length; i++)
        {
            var r = Rows[i];
            var total = r.PricePerSqm * r.Area;
            if (existing.TryGetValue(r.Ref, out var row))
            {
                // Write only when different — rewriting rows on every list call causes
                // a storm of optimistic-concurrency conflicts (409) with any concurrent adopt/save.
                var date = DateOnly.Parse(r.Date);
                var changed =
                    row.ComparablePropertyType != r.PropType
                    || row.TransactionKind != r.Kind
                    || row.PriceDescription != r.PriceDesc
                    || row.Source != r.Source
                    || row.AreaSqm != r.Area
                    || row.TransactionDate != date
                    || row.Price != total
                    || row.PricePerSqm != r.PricePerSqm
                    || row.District != r.District
                    || row.IntakeChannel != r.Intake
                    || !row.IsActive;
                if (changed)
                {
                    row.ComparablePropertyType = r.PropType;
                    row.Usage = "سكني";
                    row.TransactionKind = r.Kind;
                    row.PriceDescription = r.PriceDesc;
                    row.Source = r.Source;
                    row.AreaSqm = r.Area;
                    row.TransactionDate = date;
                    row.Price = total;
                    row.PricePerSqm = r.PricePerSqm;
                    row.City = "الرياض";
                    row.District = r.District;
                    row.IntakeChannel = r.Intake;
                    row.IsActive = true;
                    row.UpdatedAtUtc = now;
                }

                continue;
            }

            db.ComparableProperties.Add(new ComparableProperty
            {
                Id = r.Id,
                ReferenceCode = r.Ref,
                ComparablePropertyType = r.PropType,
                Usage = "سكني",
                TransactionKind = r.Kind,
                PriceDescription = r.PriceDesc,
                Source = r.Source,
                Latitude = latBase + (i * 0.004m),
                Longitude = lngBase + (i * 0.003m),
                AreaSqm = r.Area,
                TransactionDate = DateOnly.Parse(r.Date),
                Price = total,
                PricePerSqm = r.PricePerSqm,
                City = "الرياض",
                District = r.District,
                Description = $"مقارن تجريبي من تصميم التسويات — {r.Ref}",
                IntakeChannel = r.Intake,
                EnteredAtUtc = now,
                IsActive = true,
                ReliabilityTag = ComparableReliabilityTags.Normal,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
