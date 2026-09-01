using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Attachments.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Attachments.Domain;
namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Builds valuation-report field payload from live context.
/// Parallel to PDF upload — Ejada owns the business logic.
/// </summary>
public sealed class ValuationReportFieldInjectionService(
    ValuationDbContext valuation,
    ICaseStudyLookup caseStudy,
    IAttachmentLookup attachments,
    IOrganizationSettingsService organizationSettings,
    IValuationListsService valuationLists,
    IValuationComparableSelectionService selections,
    IValuationCostApproachService costApproach,
    IValuationReconciliationService reconciliation,
    TimeProvider clock) : IValuationReportFieldInjectionService
{
    private static readonly string[] PhotoFieldKeys =
    [
        "photo.01", "photo.02", "photo.03", "photo.04", "photo.05", "photo.06",
        "photo.07", "photo.08", "photo.09", "photo.10", "photo.11", "photo.12",
        "photo.13", "photo.14", "photo.15", "photo.16", "photo.17", "photo.18",
        "photo.19", "photo.20", "photo.21", "photo.22", "photo.23", "photo.24",
    ];

    private static readonly string[] DocumentFieldKeys = ["document.01", "document.02"];

    public async Task<ValuationReportFieldPayloadDto?> GetPayloadAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await valuation.ValuationRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var propertyId = vr.PropertyId?.Trim() ?? "";
        WorkOrderProperty? prop = null;
        FieldInspectionWorkspace? workspace = null;
        InspectorPayloadFacts inspector = new();
        Client? client = null;
        var deedNatureMatchOutcome = DeedNatureMatchOutcomes.Unset;
        if (Guid.TryParse(propertyId, out var propertyGuid))
        {
            var context = await caseStudy.GetValuationPropertyContextAsync(
                propertyGuid,
                cancellationToken);
            if (context is not null)
            {
                prop = context.ToProperty();
                workspace = context.LatestWorkspace?.ToWorkspace();
                inspector = InspectorPayloadFacts.Parse(context.InspectorPayloadJson);
                deedNatureMatchOutcome = context.DeedNatureMatchOutcome ?? "";
                client = context.ClientNameAr is null && context.ClientNameEn is null
                    ? null
                    : new Client
                    {
                        NameAr = context.ClientNameAr ?? "",
                        NameEn = context.ClientNameEn,
                    };
            }
        }

        var hasStructures = string.Equals( prop?.HasStructuresToValue?.Trim(), "yes", StringComparison.OrdinalIgnoreCase);

        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var cost = await costApproach.GetAsync(valuationRequestId, cancellationToken);
        var recon = await reconciliation.GetAsync(valuationRequestId, cancellationToken);
        var org = await organizationSettings.GetAsync(cancellationToken);
        var valuationCatalog = await valuationLists.GetAsync(cancellationToken);
        var printable = await LoadPrintableAttachmentsAsync(propertyId, cancellationToken);

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var bag = BuildValueBag(
            vr,
            prop,
            workspace,
            inspector,
            client,
            org,
            market,
            cost,
            recon,
            printable,
            hasStructures,
            deedNatureMatchOutcome,
            today,
            valuationCatalog);
        var fields = new List<ValuationReportFieldDto>(ValuationReportFieldCatalog.Count);
        var valuesByFieldKey = new Dictionary<string, string>(StringComparer.Ordinal);
        var filled = 0;
        var deferred = 0;
        var asset = 0;
        var resolvable = 0;

        foreach (var map in ValuationReportFieldCatalog.All)
        {
            if (ValuationReportFieldRules.IsResolvableNow(map.SourceKind))
                resolvable++;
            if (map.SourceKind == ValuationReportFieldSourceKind.Deferred)
                deferred++;
            if (map.SourceKind == ValuationReportFieldSourceKind.Asset)
                asset++;

            bag.TryGetValue(map.FieldKey, out var value);
            if (map.SourceKind == ValuationReportFieldSourceKind.ConditionalEmpty && !hasStructures)
                value = "";

            var isFilled = ValuationReportFieldRules.CountsAsFilled(value);
            if (isFilled)
            {
                filled++;
                valuesByFieldKey[map.FieldKey] = value!;
            }
            else if (map.SourceKind == ValuationReportFieldSourceKind.ConditionalEmpty)
            {
                // vacant-land conditional fields upload as explicit empty
                // instead of dropping out of the payload.
                valuesByFieldKey[map.FieldKey] = "";
            }

            fields.Add(new ValuationReportFieldDto
            {
                FieldKey = map.FieldKey,
                LabelAr = map.LabelAr,
                ValueType = ValuationReportFieldRules.ValueTypeApi(map.ValueType),
                ValueTypeLabelAr = ValuationReportFieldRules.ValueTypeLabelAr(map.ValueType),
                SourceKind = ValuationReportFieldRules.SourceKindApi(map.SourceKind),
                Value = value,
                Filled = isFilled,
                Note = map.Note,
            });
        }

        return new ValuationReportFieldPayloadDto
        {
            ValuationRequestId = vr.Id,
            DisplayId = vr.DisplayId,
            PropertyId = propertyId,
            HasStructuresToValue = hasStructures,
            CatalogCount = ValuationReportFieldCatalog.Count,
            ResolvableCount = resolvable,
            FilledCount = filled,
            DeferredCount = deferred,
            AssetCount = asset,
            Fields = fields,
            ValuesByFieldKey = valuesByFieldKey,
            TruncationNoteAr = (market?.Items ?? []).Count(i => i.IsAdopted) > 3
                ? "تنبيه: أسلوب السوق يستوعب 3 مقارنات معتمدة في الحمولة — رُفعت الثلاثة الأولى فقط من "
                  + (market?.Items ?? []).Count(i => i.IsAdopted) + " معتمدة."
                : null,
        };
    }

    private async Task<IReadOnlyList<FileAttachmentMetaDto>> LoadPrintableAttachmentsAsync(
        string propertyId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return [];

        var all = await attachments.ListForPropertyAsync(propertyId, actor: null, cancellationToken);

        var routed = all
            .Where(a => AttachmentPrintRules.TypeKeyFromScope(a.Scope) is not null)
            .OrderBy(a => a.CreatedAtUtc)
            .Take(40)
            .ToList();
        if (routed.Count > 0) return routed;

        return all
            .Where(a => a.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            .OrderBy(a => a.CreatedAtUtc)
            .Take(40)
            .ToList();
    }

    private static Dictionary<string, string?> BuildValueBag(
        ValuationRequest vr,
        WorkOrderProperty? prop,
        FieldInspectionWorkspace? workspace,
        InspectorPayloadFacts inspector,
        Client? client,
        OrganizationSettingsDto org,
        ValuationComparableSelectionListDto? market,
        ValuationCostApproachDto? cost,
        ValuationReconciliationDto? recon,
        IReadOnlyList<FileAttachmentMetaDto> printable,
        bool hasStructures,
        string deedNatureMatchOutcome,
        DateOnly today,
        ValuationListsDto? valuationCatalog = null)
    {
        var d = new Dictionary<string, string?>(StringComparer.Ordinal);

        void Put(string key, string? value) => d[key] = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        void PutMoney(string key, decimal? value)
        {
            if (value is null) return;
            Put(key, ValuationReportDisplayRules.FormatMoney(value.Value));
        }

        Put("valuation_effective_date_g", ValuationReportDisplayRules.FormatGregorianDate(today));
        Put("entry_date_g", ValuationReportDisplayRules.FormatGregorianDate(today));
        Put("assignment_number", vr.DisplayId);
        Put("basis_of_value_ar", BasisOfValueKeys.InjectionLabelAr(
            recon?.BasisOfValueKey,
            recon?.ValuePremiseKey) is { Length: > 0 } inj
            ? inj
            : BasisOfValueKeys.LabelAr(BasisOfValueKeys.Market));
        if (!string.IsNullOrWhiteSpace(recon?.ValuePremiseKey))
            Put("value_premise_ar", ValuePremiseKeys.LabelAr(recon.ValuePremiseKey));

        Put("client_requesting_entity", client?.NameAr);
        Put("client_requesting_entity_en", client?.NameEn);
        if (workspace?.InspectionDate is { } inspectionDate)
            Put("inspection_date", ValuationReportDisplayRules.FormatGregorianDate(inspectionDate));

        Put("property_type_ar", prop?.PropertyType ?? vr.PropertyType);
        Put("usage_type_ar", prop?.Classification);
        Put("region_ar", prop?.Region);
        Put("city_ar", prop?.City);
        Put("district_ar", prop?.District);
        Put("plan_number", prop?.PlanNumber);
        Put("property_plan_name", prop?.PlanName);
        Put("plot_number", prop?.PlotNumber);
        Put("property_block_number", prop?.BlockNumber);
        Put("owner_name", prop?.OwnerName);
        Put("deed_number", prop?.DeedNumber);
        Put("deed_date_h", prop?.DeedDate);
        Put("partition_minutes_number", prop?.PartitionMinutesNumber);
        if (!string.IsNullOrWhiteSpace(prop?.PartitionMinutesDate))
            Put("partition_minutes_date", prop!.PartitionMinutesDate);
        Put("north_boundary", prop?.NorthBoundary);
        Put("north_boundary_length_m", prop?.NorthBoundaryLengthM);
        Put("boundary_north_type", ValuationBoundaryTypeLabels.Resolve(valuationCatalog, prop?.NorthBoundaryType));
        Put("finishing_facade_north", prop?.NorthFacadeFinishing);
        Put("south_boundary", prop?.SouthBoundary);
        Put("south_boundary_length_m", prop?.SouthBoundaryLengthM);
        Put("boundary_south_type", ValuationBoundaryTypeLabels.Resolve(valuationCatalog, prop?.SouthBoundaryType));
        Put("finishing_facade_south", prop?.SouthFacadeFinishing);
        Put("east_boundary", prop?.EastBoundary);
        Put("east_boundary_length_m", prop?.EastBoundaryLengthM);
        Put("boundary_east_type", ValuationBoundaryTypeLabels.Resolve(valuationCatalog, prop?.EastBoundaryType));
        Put("finishing_facade_east", prop?.EastFacadeFinishing);
        Put("west_boundary", prop?.WestBoundary);
        Put("west_boundary_length_m", prop?.WestBoundaryLengthM);
        Put("boundary_west_type", ValuationBoundaryTypeLabels.Resolve(valuationCatalog, prop?.WestBoundaryType));
        Put("finishing_facade_west", prop?.WestFacadeFinishing);

        var streetCount = PropertyBoundaryTypes.CountStreets(
            prop?.NorthBoundaryType,
            prop?.SouthBoundaryType,
            prop?.EastBoundaryType,
            prop?.WestBoundaryType);
        if (streetCount > 0)
            Put("adj.65441", $"عدد الشوارع المحسوب: {streetCount}");

        Put("finishing_type", PropertyFinishingTypes.LabelAr(prop?.FinishingType));
        Put("finishing_structure", PropertyFinishingStructures.LabelAr(prop?.FinishingStructure));

        if (workspace?.MapLatitude is { } lat
            && workspace.MapLongitude is { } lon
            && ComparableProximityRules.HasUsableCoordinates(lat, lon))
        {
            Put("geo_latitude", lat.ToString(System.Globalization.CultureInfo.InvariantCulture));
            Put("geo_longitude", lon.ToString(System.Globalization.CultureInfo.InvariantCulture));
        }

        PutInspectorComponentCounts(Put, inspector, hasStructures);

        Put("valuer.name_ar", org.Evaluator.Name);
        Put("valuer.membership_number", org.Evaluator.MembershipNumber);
        var activeRoster = org.Valuers.Where(v => v.IsActive).ToList();
        Put("valuer.roster_count", activeRoster.Count.ToString());
        Put(
            "valuer.roster_names",
            string.Join(" · ", activeRoster.Select(v => v.NameAr).Where(n => !string.IsNullOrWhiteSpace(n))));
        Put("org.signature", org.Branding.SignatureUrl);
        Put("org.stamp", org.Branding.StampUrl);

        var adopted = (market?.Items ?? [])
            .Where(i => i.IsAdopted)
            .OrderBy(i => i.SortOrder)
            .Take(3)
            .ToList();

        ValuationReportFieldAdjustmentFlattenRules.PutSharedLabels(d);

        for (var i = 0; i < adopted.Count; i++)
        {
            var slot = i + 1;
            var item = adopted[i];
            var c = item.Comparable;
            Put($"comp{slot}.property_type", c.ComparablePropertyType);
            PutMoney($"comp{slot}.area_sqm", c.AreaSqm);
            Put($"comp{slot}.transaction_date", c.TransactionDate);
            PutMoney($"comp{slot}.price", c.Price);
            PutMoney($"comp{slot}.price_per_sqm", c.PricePerSqm);

            var m = item.Market;
            if (m is null) continue;

            var lite = m.AdjustmentLines
                .Select(l => new ValuationComparableAdjustmentLineDtoLite(
                    l.FactorKey,
                    l.Percent,
                    l.IsIncluded))
                .ToList();

 // the platform grid cells are per-m² — under the whole-property basis
 // the chain carries deal values, so derive rates from the comparable's area.
            var wholeBasis = string.Equals(
                market?.AdjustmentBasis, MarketAdjustmentBasisKeys.WholeProperty, StringComparison.Ordinal);
            var seqForCells = wholeBasis && c.AreaSqm > 0m
                ? Math.Round(m.PricePerSqmAfterSequential / c.AreaSqm, 2, MidpointRounding.AwayFromZero)
                : m.PricePerSqmAfterSequential;
            var diffForCells = wholeBasis && c.AreaSqm > 0m
                ? Math.Round(m.PricePerSqmAfterDifference / c.AreaSqm, 2, MidpointRounding.AwayFromZero)
                : m.PricePerSqmAfterDifference;

            ValuationReportFieldAdjustmentFlattenRules.PutSlotCells(
                d,
                i,
                lite,
                seqForCells,
                diffForCells,
                m.SumDifferencePct,
                m.EffectiveWeightPct,
                c.AreaSqm,
                c.District);
        }

        if (cost is not null)
        {
            PutMoney("cost.land_value_from_market", cost.LandValueFromMarket);
            PutMoney("cost.opinion_with_land", cost.CostOpinionWithLand);
            PutMoney("cost.buildings_only", cost.CostOpinionBuildingsOnly);
            PutMoney("cost.building_direct", cost.DirectCostTotal);
            PutMoney("cost.market_value", cost.CostOpinionWithLand);

            var costLites = cost.Lines
                .Select(l => new ValuationReportFieldCostLineLite(
                    l.StructureKind,
                    l.Label,
                    l.AreaSqm,
                    l.UnitCostSar,
                    l.IsIncluded,
                    l.ItemKey))
                .ToList();
            ValuationReportFieldCostLineFlattenRules.PutFromLines(d, costLites, hasStructures);
        }
        else if (prop?.BuildingInventoryLines is { Count: > 0 } inventoryLines)
        {
 // Area-only fallback before the appraiser prices cost lines.
            var inventoryLites = inventoryLines
                .OrderBy(l => l.SortOrder)
                .Select(l =>
                {
                    decimal.TryParse(
                        l.AreaSqm,
                        System.Globalization.NumberStyles.Number,
                        System.Globalization.CultureInfo.InvariantCulture,
                        out var area);
                    return new ValuationReportFieldCostLineLite(
                        l.StructureKind,
                        l.Label,
                        area,
                        0m,
                        true);
                })
                .ToList();
            ValuationReportFieldCostLineFlattenRules.PutFromLines(d, inventoryLites, hasStructures);
        }

        decimal? finalOpinion = null;
        if (recon is not null)
        {
            foreach (var m in recon.Methods.Where(x => x.IsIncluded))
            {
                var kind = m.ApproachKind.Trim().ToLowerInvariant();
                if (kind is "market" or "comparison")
                {
                    PutMoney("recon.weight_market_pct", m.WeightPct);
                    PutMoney("recon.contrib_market", m.ContributionValue);
                }
                else if (kind is "cost" or "replacement")
                {
                    PutMoney("recon.weight_cost_pct", m.WeightPct);
                    PutMoney("recon.contrib_cost", m.ContributionValue);
                }
                else if (kind is "income")
                {
                    PutMoney("recon.weight_income_pct", m.WeightPct);
                    PutMoney("recon.contrib_income", m.ContributionValue);
                }
            }

            finalOpinion = recon.FinalOpinionValue;
            PutMoney("final.opinion_value", recon.FinalOpinionValue);
            PutMoney("final.opinion_before_liquidation", recon.FinalOpinionBeforeLiquidation);
            PutMoney("final.liquidation_discount_pct", recon.LiquidationDiscountPct);
            if (!string.IsNullOrWhiteSpace(recon.MethodsRationale))
                Put("methods_rationale", recon.MethodsRationale);
        }
        else if (market is not null)
        {
            finalOpinion = market.MarketOpinionValue;
            PutMoney("final.opinion_value", market.MarketOpinionValue);
            PutMoney("final.opinion_before_liquidation", market.MarketOpinionValue);
        }

        if (finalOpinion is { } fo)
            Put("final.opinion_tafqit", ArabicAmountWords.AmountToArabicWords(fo));

 // 9190/9360/9370 fill at upload from system data (no printed section).
        if (finalOpinion is { } opinion && opinion > 0m)
        {
            Put("valuer_opinion_text", ValuationReportNarrativeRules.ValuerOpinionText(
                opinion,
                BasisOfValueKeys.LabelAr(recon?.BasisOfValueKey),
                recon?.MethodsRationale));
        }

        var risks = ValuationReportNarrativeRules.RisksList(
            string.Equals(recon?.BasisOfValueKey, BasisOfValueKeys.Liquidation, StringComparison.Ordinal),
            hasStructures,
            deedNatureMatchOutcome);
        Put("risks_list", string.Join(" · ", risks));
        Put("risks_text", ValuationReportNarrativeRules.RisksText(risks));

 // Images first into photo.01..24; remaining non-images into document.01..02
        var images = printable
            .Where(a => a.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            .Take(PhotoFieldKeys.Length)
            .ToList();
        for (var i = 0; i < images.Count; i++)
            Put(PhotoFieldKeys[i], $"/api/attachments/{images[i].Id:D}");

        var docs = printable
            .Where(a => !a.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            .Take(DocumentFieldKeys.Length)
            .ToList();
        for (var i = 0; i < docs.Count; i++)
            Put(DocumentFieldKeys[i], $"/api/attachments/{docs[i].Id:D}");

        _ = hasStructures;
        return d;
    }

    private static void PutInspectorComponentCounts(
        Action<string, string?> put,
        InspectorPayloadFacts inspector,
        bool hasStructures)
    {
    put("building_condition_ar", inspector.BuildState);
        put("vacancy_ar", inspector.OccupancyState);
        put("meter.4120", inspector.ElectricityMeterCount);
        put("meter.4130", inspector.ElectricityMeterNumbers);
        put("meter.4160", inspector.WaterMeterCount);
        put("meter.4170", inspector.WaterMeterNumbers);
        if (!hasStructures) return;

        put("property_age_years", inspector.PropertyAgeYears);

        put("inventory.6040", inspector.RoomCount);
        put("pending.6090", inspector.HallCount);
        put("inventory.6140", inspector.DiningCount);
        put("inventory.6190", inspector.MajlisCount);
        put("inventory.6240", inspector.MaidRoomCount);
        put("inventory.6290", inspector.Kitchen);
        put("inventory.6390", inspector.GuardRoomCount);
        put("inventory.6440", inspector.StoreCount);
        put("inventory.6490", inspector.ParkingCount);
        put("inventory.6540", inspector.BathroomCount);
        put("inventory.5330", inspector.JacuzziCount);
        put("inventory.5280", inspector.HasElevator);
        put("pending.5360", inspector.PlaygroundCount);
        put("inventory.5350", AnnexCountOrFlag(inspector));
        put("inventory.6590", inspector.OtherComponents);
    }

    private static string? AnnexCountOrFlag(InspectorPayloadFacts inspector)
    {
        var u = ParsePositive(inspector.AnnexUpperCount);
        var g = ParsePositive(inspector.AnnexGroundCount);
        if (u + g > 0) return (u + g).ToString();
        return string.IsNullOrWhiteSpace(inspector.HasAnnex) ? null : inspector.HasAnnex;
    }

    private static int ParsePositive(string? raw)
    {
        return int.TryParse((raw ?? "").Trim(), out var n) && n > 0 ? n : 0;
    }
}
