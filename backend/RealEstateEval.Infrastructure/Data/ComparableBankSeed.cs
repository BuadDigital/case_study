using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Demo bank + market adjustments from docs/_تقييم بطريقة المبيعات المشابهة
/// (التقييم بطريقة المبيعات المشابهة - نسخة مستقلة.html).
/// Idempotent by <see cref="ComparableProperty.ReferenceCode"/>.
/// </summary>
public static class ComparableBankSeed
{
    public static readonly Guid[] SeedIds =
    [
        // c1..c7 — أراضٍ (بنك النموذج التفاعلي)
        Guid.Parse("c0a10001-0000-4000-8000-000000000001"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000002"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000003"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000004"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000005"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000006"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000007"),
        // b1..b4 — فلل
        Guid.Parse("c0a10001-0000-4000-8000-000000000008"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000009"),
        Guid.Parse("c0a10001-0000-4000-8000-00000000000a"),
        Guid.Parse("c0a10001-0000-4000-8000-00000000000b"),
        // a1..a3 — شقق
        Guid.Parse("c0a10001-0000-4000-8000-00000000000c"),
        Guid.Parse("c0a10001-0000-4000-8000-00000000000d"),
        Guid.Parse("c0a10001-0000-4000-8000-00000000000e"),
    ];

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
        // compSpec — أوصاف المقارن لكل عامل اختلاف (من بنك النموذج التفاعلي).
        string SpecIdeal,
        string SpecAttraction,
        string SpecAccess,
        string SpecStreetsCount,
        string SpecStreetsLength);

    // البيانات نفسها من docs/_تقييم بطريقة المبيعات المشابهة (v2 dc.html — BANK + BUILT).
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
        // BUILT — فلل
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
        // شقق
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
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await EnsureBankRowsAsync(db, now, cancellationToken);
        await AttachToOpenValuationsAsync(db, now, cancellationToken);
    }

    /// <summary>
    /// Ensures bank rows exist and attaches seed comps to one valuation if missing.
    /// Safe to call from list/selection endpoints (idempotent).
    /// </summary>
    public static async Task EnsureForValuationRequestAsync(
        ValuationDbContext db,
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await EnsureBankRowsAsync(db, now, cancellationToken);
        await AttachToValuationAsync(db, valuationRequestId, now, cancellationToken);
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
                // اكتب فقط عند الاختلاف — إعادة كتابة الصفوف مع كل نداء قائمة تُحدث
                // عاصفة تعارضات تفاؤلية (409) مع أي اعتماد/حفظ متزامن.
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

    private static async Task AttachToOpenValuationsAsync(
        ValuationDbContext db,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var openIds = await db.ValuationRequests
            .AsNoTracking()
            .Where(v => v.Status != ValuationRequestStatus.Done)
            .Select(v => v.Id)
            .ToListAsync(cancellationToken);

        if (openIds.Count == 0) return;

        var compsByRef = await db.ComparableProperties
            .AsNoTracking()
            .Where(c => Rows.Select(r => r.Ref).Contains(c.ReferenceCode))
            .ToDictionaryAsync(c => c.ReferenceCode, cancellationToken);

        if (compsByRef.Count == 0) return;

        var seedCompIds = compsByRef.Values.Select(c => c.Id).ToHashSet();

        var alreadyLinked = await db.ValuationComparableSelections
            .AsNoTracking()
            .Where(s =>
                openIds.Contains(s.ValuationRequestId)
                && s.SelectionContext == ComparableSelectionContexts.Market
                && seedCompIds.Contains(s.ComparablePropertyId))
            .Select(s => s.ValuationRequestId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var targets = openIds.Except(alreadyLinked).ToList();
        if (targets.Count == 0) return;

        foreach (var vrId in targets)
            await AttachToValuationAsync(db, vrId, now, cancellationToken);
    }

    private static async Task AttachToValuationAsync(
        ValuationDbContext db,
        Guid vrId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var exists = await db.ValuationRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(
                v => v.Id == vrId && v.Status != ValuationRequestStatus.Done,
                cancellationToken);
        if (exists is null) return;

        var compsByRef = await db.ComparableProperties
            .Where(c => Rows.Select(r => r.Ref).Contains(c.ReferenceCode))
            .ToDictionaryAsync(c => c.ReferenceCode, cancellationToken);
        if (compsByRef.Count == 0) return;

        // مواصفة §٢: ربط المقارنات الميدانية بهذا العقار لأولوية العرض.
        if (Guid.TryParse(exists.PropertyId, out var subjectPropertyId)
            && subjectPropertyId != Guid.Empty)
        {
            foreach (var r in Rows.Where(x =>
                         x.Source == ComparableSources.Field
                         || x.Intake == ComparableIntakeChannels.Field))
            {
                if (!compsByRef.TryGetValue(r.Ref, out var comp)) continue;
                var tracked = await db.ComparableProperties
                    .FirstOrDefaultAsync(c => c.Id == comp.Id, cancellationToken);
                if (tracked is null) continue;
                // اكتب فقط عند الاختلاف — تفادياً لتعارضات xmin مع الطلبات المتزامنة.
                if (tracked.SourcePropertyId != subjectPropertyId)
                    tracked.SourcePropertyId = subjectPropertyId;
                tracked.SourceWorkOrderNumber ??= "SEED-FIELD";
            }
        }

        var seedCompIds = compsByRef.Values.Select(c => c.Id).ToHashSet();
        var already = await db.ValuationComparableSelections
            .AsNoTracking()
            .AnyAsync(
                s =>
                    s.ValuationRequestId == vrId
                    && s.SelectionContext == ComparableSelectionContexts.Market
                    && seedCompIds.Contains(s.ComparablePropertyId),
                cancellationToken);
        if (already)
        {
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        var header = await db.ValuationMarketApproaches
            .FirstOrDefaultAsync(h => h.ValuationRequestId == vrId, cancellationToken);
        if (header is null)
        {
            db.ValuationMarketApproaches.Add(new ValuationMarketApproach
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = vrId,
                SubjectAreaSqm = 900m,
                AdjustmentBasis = MarketAdjustmentBasisKeys.PricePerSqm,
                AreaFactorPct = AreaAdjustmentRules.DefaultAreaFactorPct,
                    AnnualMarketRatePct = MarketApproachRules.DefaultAnnualMarketRatePct,
                    ValueRoundDecimals = MarketApproachRules.DefaultValueRoundDecimals,
                    AnalysisNotes =
                    "بيانات تجريبية — بنك المقارنات وجدول التسويات من تصميم طريقة المقارنة.",
                UpdatedAtUtc = now,
            });
        }
        else if (header.SubjectAreaSqm is null or 0)
        {
            header.SubjectAreaSqm = 900m;
            header.UpdatedAtUtc = now;
        }

        var existingMaxSort = await db.ValuationComparableSelections
            .Where(s =>
                s.ValuationRequestId == vrId
                && s.SelectionContext == ComparableSelectionContexts.Market)
            .Select(s => (int?)s.SortOrder)
            .MaxAsync(cancellationToken) ?? -1;

        // الحد الأقصى ٥ معتمدة (مواصفة النموذج): عند وجود اعتمادات سابقة (مقارنات مستوردة
        // من روابط العقار) تُرفق بذور النموذج غير معتمدة حتى لا يتجاوز الجدول السقف.
        var adoptedAlready = await db.ValuationComparableSelections
            .AsNoTracking()
            .CountAsync(
                s =>
                    s.ValuationRequestId == vrId
                    && s.SelectionContext == ComparableSelectionContexts.Market
                    && s.IsAdopted,
                cancellationToken);

        var sort = existingMaxSort + 1;
        foreach (var r in Rows)
        {
            if (!compsByRef.TryGetValue(r.Ref, out var comp)) continue;
            var selectionId = Guid.NewGuid();
            var selection = new ValuationComparableSelection
            {
                Id = selectionId,
                ValuationRequestId = vrId,
                ComparablePropertyId = comp.Id,
                SelectionContext = ComparableSelectionContexts.Market,
                SortOrder = sort++,
                IsAdopted = adoptedAlready == 0 && r.AdoptDefault,
                SelectedAtUtc = now,
                WeightIsManual = false,
                AreaAdjustmentMethod = AreaAdjustmentMethods.Amthal,
            };
            db.ValuationComparableSelections.Add(selection);

            var lines = MarketApproachRules.CreateStandardMarketLines(selectionId).ToList();
            ApplySeedSpecs(lines, r);
            foreach (var line in lines)
                db.ValuationComparableAdjustmentLines.Add(line);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// compSpec من النموذج التفاعلي: أوصاف المقارن لكل عامل اختلاف — النِّسَب تبدأ صفراً
    /// (الافتراضات المقترحة لنوع المقارن يحسبها المحرك، لا البذرة).
    /// </summary>
    private static void ApplySeedSpecs(
        List<ValuationComparableAdjustmentLine> lines,
        BankRow r)
    {
        void Describe(string key, string description)
        {
            var line = lines.FirstOrDefault(l => l.FactorKey == key);
            if (line is null || string.IsNullOrWhiteSpace(description)) return;
            line.DescriptionAr = description;
        }

        Describe(MarketAdjustmentFactorKeys.IdealArea, r.SpecIdeal);
        Describe(MarketAdjustmentFactorKeys.Attraction, r.SpecAttraction);
        Describe(MarketAdjustmentFactorKeys.Access, r.SpecAccess);
        Describe(MarketAdjustmentFactorKeys.StreetCount, r.SpecStreetsCount);
        Describe(MarketAdjustmentFactorKeys.StreetLengths, r.SpecStreetsLength);
    }
}
