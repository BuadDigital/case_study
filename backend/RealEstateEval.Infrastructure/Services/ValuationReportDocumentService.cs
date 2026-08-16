using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Builds the 27-section document outline + live fill for approved-template merge.
/// Letterhead chrome comes from /ejadah/report-template-approved.html (shell public).
/// </summary>
public sealed class ValuationReportDocumentService(
    ValuationDbContext valuation,
    CaseStudyDbContext caseStudy,
    AttachmentsDbContext attachments,
    IOrganizationSettingsService organizationSettings,
    IAttachmentPrintDictionaryService printDictionary,
    IValuationComparableSelectionService selections,
    IValuationCostApproachService costApproach,
    IValuationReconciliationService reconciliation,
    IValuationIssuanceGateService issuanceGates,
    TimeProvider clock) : IValuationReportDocumentService
{
    public async Task<ValuationReportDocumentDto?> GetPreviewAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await valuation.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var propertyId = vr.PropertyId?.Trim() ?? "";
        WorkOrderProperty? prop = null;
        FieldInspectionWorkspace? workspace = null;
        InspectorPayloadFacts inspector = new();
        string? clientNameAr = null;
        IReadOnlyList<string> reportUserNames = [];
        if (Guid.TryParse(propertyId, out var propertyGuid))
        {
            prop = await caseStudy.WorkOrderProperties.AsNoTracking()
                .Include(p => p.BuildingInventoryLines)
                .FirstOrDefaultAsync(p => p.Id == propertyGuid, cancellationToken);
            workspace = await caseStudy.FieldInspectionWorkspaces.AsNoTracking()
                .Where(w => w.PropertyId == propertyGuid)
                .OrderByDescending(w => w.UpdatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            // Building-mode facts come from the inspector's submission (single source, decision 10).
            if (workspace is not null)
            {
                var payloadJson = await caseStudy.PartyTaskSubmissions.AsNoTracking()
                    .Where(s => s.Id == workspace.PartyTaskSubmissionId)
                    .Select(s => s.PayloadJson)
                    .FirstOrDefaultAsync(cancellationToken);
                inspector = InspectorPayloadFacts.Parse(payloadJson);
            }

            // §4ج-1 — client name derives from the registry; report users 0..n.
            if (prop is not null)
            {
                var wo = await caseStudy.WorkOrders.AsNoTracking()
                    .FirstOrDefaultAsync(w => w.Id == prop.WorkOrderId, cancellationToken);
                if (wo is not null)
                {
                    var reportUserIds = WorkOrderReportUsers.Parse(wo.ReportUserClientIdsJson);
                    var lookupIds = reportUserIds.ToList();
                    if (wo.ClientId is { } cid) lookupIds.Add(cid);
                    if (lookupIds.Count > 0)
                    {
                        var names = await caseStudy.Clients.AsNoTracking()
                            .Where(c => lookupIds.Contains(c.Id))
                            .ToDictionaryAsync(c => c.Id, c => c.NameAr, cancellationToken);
                        if (wo.ClientId is { } clientId)
                            clientNameAr = names.GetValueOrDefault(clientId);
                        reportUserNames = reportUserIds
                            .Select(id => names.GetValueOrDefault(id))
                            .Where(n => !string.IsNullOrWhiteSpace(n))
                            .Select(n => n!)
                            .ToList();
                    }
                }
            }
        }

        var hasStructures = string.Equals(
            prop?.HasStructuresToValue?.Trim(),
            "yes",
            StringComparison.OrdinalIgnoreCase);

        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var cost = await costApproach.GetAsync(valuationRequestId, cancellationToken);
        var recon = await reconciliation.GetAsync(valuationRequestId, cancellationToken);
        var gates = await issuanceGates.EvaluateAsync(valuationRequestId, cancellationToken);
        // §7.5 / IVS 106 8-30 — an unresolved deed↔nature match is a material
        // restriction: the standards text must not claim full compliance.
        var complianceRestricted = gates?.Gates
            .Any(g => g.Code == ValuationIssuanceGateCodes.DeedNatureMatch && !g.Passed) == true;
        var org = await organizationSettings.GetAsync(cancellationToken);

        var marketUsed = (market?.AdoptedCount ?? 0) > 0 || (market?.MarketOpinionValue ?? 0m) > 0m;
        var costUsed = (cost?.CostOpinionWithLand ?? 0m) > 0m
            || (cost?.Lines.Count ?? 0) > 0;
        const bool incomeUsed = false;

        var visible = ValuationReportSectionCatalog.ResolveVisible(
            hasStructures,
            marketUsed,
            costUsed,
            incomeUsed);

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var sections = visible.Select(def =>
        {
            var title = ValuationReportSectionCatalog.DisplayTitleAr(def, hasStructures);
            var fields = BuildFields(
                def.Key,
                vr,
                prop,
                workspace,
                org,
                market,
                cost,
                recon,
                hasStructures,
                marketUsed,
                costUsed,
                clientNameAr,
                reportUserNames,
                inspector,
                complianceRestricted);
            return new ValuationReportSectionDto
            {
                Number = def.Number,
                Key = def.Key,
                TitleAr = title,
                BodyKind = def.BodyKind.ToString(),
                Included = true,
                PreviewText = BuildPreviewText(def.Key, fields, def.BodyKind),
                Fields = fields,
            };
        }).ToList();

        var final = recon?.FinalOpinionValue;
        var adopted = (market?.Items ?? [])
            .Where(i => i.IsAdopted)
            .OrderBy(i => i.SortOrder)
            .ToList();

        var comparableRows = adopted
            .Select((i, idx) =>
            {
                var c = i.Comparable;
                return new ValuationReportComparableRowDto
                {
                    Index = idx + 1,
                    ComparablePropertyType = c.ComparablePropertyType,
                    TransactionCell = ComposeTransactionCell(c),
                    AreaSqmDisplay = ValuationReportDisplayRules.FormatMoney(c.AreaSqm),
                    TransactionDateDisplay = FormatDateDisplay(c.TransactionDate),
                    PriceDisplay = ValuationReportDisplayRules.FormatMoney(c.Price),
                    PricePerSqmDisplay = ValuationReportDisplayRules.FormatMoney(c.PricePerSqm),
                };
            })
            .ToList();

        var adjustmentRows = adopted
            .Select((i, idx) =>
            {
                var m = i.Market;
                return new ValuationReportAdjustmentRowDto
                {
                    Index = idx + 1,
                    ComparableLabel = i.Comparable.ComparablePropertyType,
                    SequentialPctDisplay = m is null
                        ? "-"
                        : ValuationReportDisplayRules.FormatMoney(m.SumSequentialPct),
                    DifferencePctDisplay = m is null
                        ? "-"
                        : ValuationReportDisplayRules.FormatMoney(m.SumDifferencePct),
                    WeightPctDisplay = m is null
                        ? "-"
                        : ValuationReportDisplayRules.FormatMoney(m.EffectiveWeightPct),
                    AdjustedPricePerSqmDisplay = m is null
                        ? "-"
                        : ValuationReportDisplayRules.FormatMoney(m.PricePerSqmAfterDifference),
                };
            })
            .ToList();

        var reconRows = (recon?.Methods ?? [])
            .Where(m => m.IsIncluded)
            .OrderBy(m => m.SortOrder)
            .Select(m => new ValuationReportReconMethodRowDto
            {
                LabelAr = m.LabelAr,
                ApproachValueDisplay = ValuationReportDisplayRules.FormatMoney(m.ApproachValue),
                WeightPctDisplay = ValuationReportDisplayRules.FormatMoney(m.WeightPct),
                ContributionDisplay = ValuationReportDisplayRules.FormatMoney(m.ContributionValue),
            })
            .ToList();

        var printed = await LoadPrintedAttachmentsAsync(
            propertyId,
            hasStructures,
            cancellationToken);

        // 11ف — «لا صفحات لأنواع غير مرفوعة»: attachment sections without uploads drop out.
        var attachmentCounts = new Dictionary<int, int>
        {
            [22] = printed.SiteMaps.Count,
            [23] = printed.Photos.Count,
            [24] = printed.Survey.Count,
            [25] = printed.Deed.Count,
        };
        sections = sections
            .Select(s => attachmentCounts.TryGetValue(s.Number, out var count) && count == 0
                ? new ValuationReportSectionDto
                {
                    Number = s.Number,
                    Key = s.Key,
                    TitleAr = s.TitleAr,
                    BodyKind = s.BodyKind,
                    Included = false,
                    PreviewText = s.PreviewText,
                    Fields = s.Fields,
                }
                : s)
            .ToList();

        return new ValuationReportDocumentDto
        {
            ValuationRequestId = vr.Id,
            PropertyId = propertyId,
            DisplayId = vr.DisplayId,
            HasStructuresToValue = hasStructures,
            MarketApproachUsed = marketUsed,
            CostApproachUsed = costUsed,
            IncomeApproachUsed = incomeUsed,
            ReportNumber = ValuationReportNumberRules.FormatTemporary(vr.DisplayId, today),
            ReportDateDisplay = ValuationReportDisplayRules.FormatGregorianDate(today),
            ValidUntilDisplay = ValuationReportDisplayRules.FormatGregorianDate(
                ValuationReportValidityRules.ValidUntil(today)),
            ValidityNoteAr = ValuationReportValidityRules.NoteAr(today),
            ReportDateHijriDisplay = ValuationReportDisplayRules.FormatHijriDate(today),
            PhotoBudgetHintAr = ValuationReportSectionCatalog.PhotoBudgetHint(hasStructures),
            ValuerWordPlain = ValuationReportDisplayRules.ValuerWordPlain,
            FinalOpinionValue = final,
            FinalOpinionDisplay = final is null
                ? null
                : ValuationReportDisplayRules.FormatMoney(final.Value),
            FinalOpinionTafqit = final is null
                ? null
                : ArabicAmountWords.AmountToArabicWords(final.Value),
            WeightedValueDisplay = recon is null
                ? null
                : ValuationReportDisplayRules.FormatMoney(recon.WeightedValue),
            MethodsRationale = recon?.MethodsRationale,
            AllowsIssuance = gates?.AllowsIssuance ?? false,
            TextLayerNoteAr =
                $"طبقة النصوص الثابتة: {ValuationReportFrozenTextLayers.VersionId} — تُجمَّد عند الإصدار.",
            ApprovedTemplateUrl = "/ejadah/report-template-approved.html",
            LetterheadImageUrl = org?.Branding?.LetterheadUrl,
            MarketMethodLabelAr = marketUsed ? "طريقة البيوع المقارنة" : "غير مستخدم",
            CostMethodLabelAr = costUsed ? "طريقة المقاول" : "غير مستخدم",
            IncomeMethodLabelAr = "غير مستخدم",
            WeightedPricePerSqmDisplay = market is null
                ? null
                : ValuationReportDisplayRules.FormatMoney(market.WeightedPricePerSqm),
            MarketOpinionDisplay = market is null
                ? null
                : ValuationReportDisplayRules.FormatMoney(market.MarketOpinionValue),
            SubjectAreaSqmDisplay = market?.SubjectAreaSqm is null
                ? null
                : ValuationReportDisplayRules.FormatMoney(market.SubjectAreaSqm.Value),
            LandValueFromMarketDisplay = cost is null
                ? null
                : ValuationReportDisplayRules.FormatMoney(cost.LandValueFromMarket),
            CostOpinionWithLandDisplay = cost is null
                ? null
                : ValuationReportDisplayRules.FormatMoney(cost.CostOpinionWithLand),
            CostOpinionBuildingsOnlyDisplay = cost is null
                ? null
                : ValuationReportDisplayRules.FormatMoney(cost.CostOpinionBuildingsOnly),
            Comparables = comparableRows,
            Adjustments = adjustmentRows,
            ReconciliationMethods = reconRows,
            SiteMapAttachments = printed.SiteMaps,
            PhotoAttachments = printed.Photos,
            SurveyAttachments = printed.Survey,
            DeedAttachments = printed.Deed,
            Sections = sections,
        };
    }

    private async Task<(
        List<ValuationReportPrintedAttachmentDto> SiteMaps,
        List<ValuationReportPrintedAttachmentDto> Photos,
        List<ValuationReportPrintedAttachmentDto> Survey,
        List<ValuationReportPrintedAttachmentDto> Deed)> LoadPrintedAttachmentsAsync(
        string propertyId,
        bool hasStructures,
        CancellationToken cancellationToken)
    {
        List<ValuationReportPrintedAttachmentDto> siteMaps = [];
        List<ValuationReportPrintedAttachmentDto> photos = [];
        List<ValuationReportPrintedAttachmentDto> survey = [];
        List<ValuationReportPrintedAttachmentDto> deed = [];

        if (string.IsNullOrWhiteSpace(propertyId))
            return (siteMaps, photos, survey, deed);

        var rows = await attachments.FileAttachments.AsNoTracking()
            .Where(a => a.PrintInReport && a.ScopeKey.Contains(propertyId))
            .OrderBy(a => a.CreatedAtUtc)
            .Take(60)
            .ToListAsync(cancellationToken);

        var photoBudget = AttachmentPrintRules.PhotoBudget(hasStructures);

        // 11س — photos are auto-dated at capture; the caption prints the date.
        var rowIds = rows.Select(r => r.Id).ToList();
        var capturedAt = await attachments.PhotoMetadata.AsNoTracking()
            .Where(m => rowIds.Contains(m.PhotoId) && m.CapturedAtUtc != null)
            .ToDictionaryAsync(m => m.PhotoId, m => m.CapturedAtUtc, cancellationToken);

        // 11ف — freely-defined dictionary types must not be silently dropped: any
        // active custom type routes to the appendix bucket (section 25) with its
        // dictionary label, until the page-flow engine gives each its own page.
        var dictionary = await printDictionary.GetAsync(cancellationToken);
        var dictionaryLabels = dictionary.Types
            .Where(t => t.IsActive)
            .ToDictionary(
                t => t.Key.Trim().ToLowerInvariant(),
                t => t.LabelAr,
                StringComparer.Ordinal);

        foreach (var a in rows)
        {
            if (!AttachmentPrintRules.IsPrintable(a.DictionaryTypeKey, a.PrintInReport))
                continue;

            var normalizedKey = a.DictionaryTypeKey.Trim().ToLowerInvariant();
            var section = AttachmentPrintRules.ReportSectionNumber(a.DictionaryTypeKey);
            if (section is null)
            {
                if (!dictionaryLabels.ContainsKey(normalizedKey)) continue;
                section = 25;
            }

            var isImage = a.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
            var dto = new ValuationReportPrintedAttachmentDto
            {
                AttachmentId = a.Id,
                ContentUrl = $"/api/attachments/{a.Id:D}",
                ContentType = a.ContentType,
                DictionaryTypeKey = normalizedKey,
                LabelAr = dictionaryLabels.GetValueOrDefault(
                    normalizedKey,
                    AttachmentPrintRules.LabelArForTypeKey(a.DictionaryTypeKey)),
                FileName = a.FileName,
                ReportSectionNumber = section.Value,
                IsImage = isImage,
                CapturedAtDisplay = capturedAt.TryGetValue(a.Id, out var cap) && cap is { } capUtc
                    ? ValuationReportDisplayRules.FormatGregorianDate(DateOnly.FromDateTime(capUtc))
                    : null,
            };

            switch (section.Value)
            {
                case 22:
                    siteMaps.Add(dto);
                    break;
                case 23:
                    if (photos.Count < photoBudget)
                        photos.Add(dto);
                    break;
                case 24:
                    survey.Add(dto);
                    break;
                case 25:
                    deed.Add(dto);
                    break;
            }
        }

        return (siteMaps, photos, survey, deed);
    }

    private static string ComposeTransactionCell(ComparablePropertyDto c)
    {
        var bits = new List<string>
        {
            c.TransactionKindLabelAr,
        };
        if (!string.IsNullOrWhiteSpace(c.PriceDescriptionLabelAr))
            bits.Add(c.PriceDescriptionLabelAr);
        if (!string.IsNullOrWhiteSpace(c.Source))
            bits.Add(ComparableSources.LabelAr(c.Source));
        if (!string.IsNullOrWhiteSpace(c.ListingNumber))
            bits.Add(c.ListingNumber!);
        if (!string.IsNullOrWhiteSpace(c.AdvertiserPhone))
            bits.Add(c.AdvertiserPhone!);
        return string.Join(" / ", bits);
    }

    private static string FormatDateDisplay(string ymd)
    {
        if (DateOnly.TryParse(ymd, out var d))
            return ValuationReportDisplayRules.FormatGregorianDate(d);
        return ymd;
    }

    private static IReadOnlyDictionary<string, string?> BuildFields(
        string key,
        ValuationRequest vr,
        WorkOrderProperty? prop,
        FieldInspectionWorkspace? workspace,
        OrganizationSettingsDto org,
        ValuationComparableSelectionListDto? market,
        ValuationCostApproachDto? cost,
        ValuationReconciliationDto? recon,
        bool hasStructures,
        bool marketUsed,
        bool costUsed,
        string? clientNameAr = null,
        IReadOnlyList<string>? reportUserNames = null,
        InspectorPayloadFacts? inspector = null,
        bool complianceRestricted = false)
    {
        inspector ??= new InspectorPayloadFacts();
        var d = new Dictionary<string, string?>(StringComparer.Ordinal);
        var adopted = (market?.Items ?? []).Where(i => i.IsAdopted).OrderBy(i => i.SortOrder).ToList();
        var basisLabel = string.IsNullOrWhiteSpace(recon?.BasisOfValueLabelAr)
            ? BasisOfValueKeys.LabelAr(recon?.BasisOfValueKey ?? BasisOfValueKeys.Market)
            : recon!.BasisOfValueLabelAr;
        var premiseLabel = recon?.ValuePremiseLabelAr;

        switch (key)
        {
            case ValuationReportSectionKeys.ValuerIdentity:
                d["name"] = org.Evaluator.Name;
                d["licenseNumber"] = org.Evaluator.LicenseNumber;
                d["membershipNumber"] = org.Evaluator.MembershipNumber;
                d["licenseExpiresAt"] = ValuationReportDisplayRules.FormatIsoDateString(
                    org.Evaluator.LicenseExpiresAt);
                d["membershipExpiresAt"] = ValuationReportDisplayRules.FormatIsoDateString(
                    org.Evaluator.MembershipExpiresAt);
                break;

            case ValuationReportSectionKeys.KeyInputs:
                d["basis"] = basisLabel;
                d["premise"] = premiseLabel;
                d["currency"] = "الريال السعودي";
                d["reportType"] = "تقرير مفصل";
                d["propertyType"] = prop?.PropertyType ?? vr.PropertyType;
                d["area"] = prop?.Area ?? vr.Area;
                d["hasStructures"] = hasStructures ? "نعم" : "لا";
                d["marketOpinion"] = market is null
                    ? null
                    : ValuationReportDisplayRules.FormatMoney(market.MarketOpinionValue);
                d["costOpinion"] = cost is null
                    ? null
                    : ValuationReportDisplayRules.FormatMoney(cost.CostOpinionWithLand);
                d["finalOpinion"] = recon is null
                    ? null
                    : ValuationReportDisplayRules.FormatMoney(recon.FinalOpinionValue);
                break;

            case ValuationReportSectionKeys.ScopeOfWork:
                d["displayId"] = vr.DisplayId;
                d["propertyType"] = prop?.PropertyType ?? vr.PropertyType;
                d["area"] = prop?.Area ?? vr.Area;
                d["reportType"] = "تقرير مفصل";
                d["currency"] = "الريال السعودي";
                d["basis"] = basisLabel;
                d["premise"] = premiseLabel;
                // §4ج-1 — client from the registry + report users + derived usage sentence.
                d["clientName"] = clientNameAr;
                d["reportUsers"] = reportUserNames is { Count: > 0 }
                    ? string.Join(" · ", reportUserNames)
                    : null;
                d["usageRestriction"] = ValuationReportNarrativeRules.UsageRestrictionSentence(
                    clientNameAr, reportUserNames ?? []);
                break;

            case ValuationReportSectionKeys.SubjectAsset:
                d["deedNumber"] = prop?.DeedNumber;
                d["deedKind"] = prop is null
                    ? null
                    : DeedKindLabels.ToApiValue(prop.DeedKind);
                d["deedKindLabel"] = prop is null
                    ? null
                    : DeedKindLabels.LabelAr(prop.DeedKind);
                d["ownerName"] = prop?.OwnerName;
                // Decision 5 (سجل v2): نوع الملكية field in section 6 — editable-derived.
                d["ownershipType"] = prop is null
                    ? null
                    : OwnershipTypes.LabelAr(OwnershipTypeRules.Effective(
                        prop.OwnershipTypeIsManual,
                        prop.OwnershipType,
                        OwnershipTypeRules.ParseOwners(prop.DeedOwnersJson),
                        prop.RestrictionType));
                d["hasStructures"] = hasStructures ? "yes" : "no";
                // Decision 6 — حالة العقار prints for buildings only, deleted for land;
                // source is the field inspector (بند «حالة البناء»).
                d["propertyCondition"] = hasStructures ? inspector.BuildState : null;
                // §4ج-12 — المنقولات وصف حر من الميداني؛ الغياب يُدوَّن نفيًا.
                d["movables"] = inspector.Movables switch
                {
                    "نعم" => "يوجد منقولات بالعقار (وفق معاينة الميداني)",
                    "لا" => "لا يوجد منقولات بالعقار",
                    _ => null,
                };
                d["inventorySummary"] = hasStructures && prop?.BuildingInventoryLines is { Count: > 0 } inv
                    ? string.Join(
                        " · ",
                        inv.OrderBy(l => l.SortOrder)
                            .Where(l => CostApproachRules.TryParseArea(l.AreaSqm, out var a) && a > 0m)
                            .Select(l => $"{l.Label}: {l.AreaSqm} م²"))
                    : null;
                d["city"] = prop?.City;
                d["district"] = prop?.District;
                break;

            case ValuationReportSectionKeys.LocationDetails:
                d["region"] = prop?.Region;
                d["city"] = prop?.City;
                d["district"] = prop?.District;
                // Decision 8ب — building rows deleted for land, shown for buildings.
                d["buildingAge"] = hasStructures ? inspector.PropertyAgeYears : null;
                d["occupancyState"] = hasStructures ? inspector.OccupancyState : null;
                d["planNumber"] = prop?.PlanNumber;
                d["planName"] = prop?.PlanName;
                d["plotNumber"] = prop?.PlotNumber;
                d["blockNumber"] = prop?.BlockNumber;
                break;

            case ValuationReportSectionKeys.Boundaries:
                d["north"] = JoinBoundary(prop?.NorthBoundary, prop?.NorthBoundaryLengthM);
                d["northType"] = PropertyBoundaryTypes.LabelAr(prop?.NorthBoundaryType);
                d["northFacade"] = prop?.NorthFacadeFinishing;
                d["south"] = JoinBoundary(prop?.SouthBoundary, prop?.SouthBoundaryLengthM);
                d["southType"] = PropertyBoundaryTypes.LabelAr(prop?.SouthBoundaryType);
                d["southFacade"] = prop?.SouthFacadeFinishing;
                d["east"] = JoinBoundary(prop?.EastBoundary, prop?.EastBoundaryLengthM);
                d["eastType"] = PropertyBoundaryTypes.LabelAr(prop?.EastBoundaryType);
                d["eastFacade"] = prop?.EastFacadeFinishing;
                d["west"] = JoinBoundary(prop?.WestBoundary, prop?.WestBoundaryLengthM);
                d["westType"] = PropertyBoundaryTypes.LabelAr(prop?.WestBoundaryType);
                d["westFacade"] = prop?.WestFacadeFinishing;
                d["streetCount"] = PropertyBoundaryTypes.CountStreets(
                    prop?.NorthBoundaryType,
                    prop?.SouthBoundaryType,
                    prop?.EastBoundaryType,
                    prop?.WestBoundaryType).ToString();
                break;

            case ValuationReportSectionKeys.Participants:
                d["certifiedName"] = org.Evaluator.Name;
                d["rosterCount"] = org.Valuers.Count(v => v.IsActive).ToString();
                d["rosterNames"] = string.Join(" · ",
                    org.Valuers.Where(v => v.IsActive).Select(v => v.NameAr).Where(n => !string.IsNullOrWhiteSpace(n)));
                break;

            case ValuationReportSectionKeys.ApproachesUsed:
                d["market"] = marketUsed ? "طريقة البيوع المقارنة" : "غير مستخدم";
                d["cost"] = costUsed ? "طريقة المقاول" : "غير مستخدم";
                d["income"] = "غير مستخدم";
                break;

            case ValuationReportSectionKeys.Comparables:
                d["adoptedCount"] = (market?.AdoptedCount ?? 0).ToString();
                d["weightedPricePerSqm"] = market is null
                    ? null
                    : ValuationReportDisplayRules.FormatMoney(market.WeightedPricePerSqm);
                d["marketOpinion"] = market is null
                    ? null
                    : ValuationReportDisplayRules.FormatMoney(market.MarketOpinionValue);
                break;

            case ValuationReportSectionKeys.ComparablesMap:
            {
                string? subLat = null;
                string? subLon = null;
                if (workspace?.MapLatitude is { } lat
                    && workspace.MapLongitude is { } lon
                    && ComparableProximityRules.HasUsableCoordinates(lat, lon))
                {
                    subLat = lat.ToString(System.Globalization.CultureInfo.InvariantCulture);
                    subLon = lon.ToString(System.Globalization.CultureInfo.InvariantCulture);
                }

                var points = adopted
                    .Select((i, idx) =>
                    {
                        var c = i.Comparable;
                        string? pLat = null;
                        string? pLon = null;
                        if (ComparableProximityRules.HasUsableCoordinates(c.Latitude, c.Longitude))
                        {
                            pLat = c.Latitude.ToString(System.Globalization.CultureInfo.InvariantCulture);
                            pLon = c.Longitude.ToString(System.Globalization.CultureInfo.InvariantCulture);
                        }

                        return (idx + 1, c.ComparablePropertyType, pLat, pLon);
                    })
                    .ToList();

                d["body"] = ValuationReportNarrativeRules.ComparablesMapBody(subLat, subLon, points);
                d["subjectLatitude"] = subLat;
                d["subjectLongitude"] = subLon;
                d["pointCount"] = points.Count.ToString();
                break;
            }

            case ValuationReportSectionKeys.Adjustments:
                d["note"] = "التسويات التسلسلية وعوامل الاختلاف من تبويب المقارنات — تُطبع المبررات دون الاقتراح الآلي.";
                // ت-1 #14 — the renderer switches the adjusted-amount column label on this.
                d["adjustmentBasis"] = market?.AdjustmentBasis ?? "price_per_sqm";
                d["adjustmentBasisLabel"] = market?.AdjustmentBasisLabelAr;
                break;

            case ValuationReportSectionKeys.MethodsRationale:
                d["rationale"] = recon?.MethodsRationale;
                d["multiMethod"] = recon?.MeetsMultiMethodGate == true ? "yes" : "no";
                break;

            case ValuationReportSectionKeys.FinalValue:
                d["weighted"] = recon is null
                    ? null
                    : ValuationReportDisplayRules.FormatMoney(recon.WeightedValue);
                d["beforeLiquidation"] = recon is null
                    ? null
                    : ValuationReportDisplayRules.FormatMoney(recon.FinalOpinionBeforeLiquidation);
                d["final"] = recon is null
                    ? null
                    : ValuationReportDisplayRules.FormatMoney(recon.FinalOpinionValue);
                d["discountPct"] = recon is null || !recon.LiquidationDiscountApplied
                    ? null
                    : ValuationReportDisplayRules.FormatMoney(recon.LiquidationDiscountPct);
                d["basis"] = basisLabel;
                d["premise"] = premiseLabel;
                d["roundDecimals"] = recon?.FinalRoundDecimals.ToString();
                break;

            case ValuationReportSectionKeys.ResearchScope:
                d["body"] = ValuationReportNarrativeRules.ResearchScopeBody(
                    adopted.Select(i => i.Comparable.Source).ToList(),
                    adopted.Count);
                d["adoptedCount"] = adopted.Count.ToString();
                break;

            case ValuationReportSectionKeys.SpecialAssumptions:
            {
                var deedKindAr = prop is null
                    ? null
                    : prop.DeedKind == DeedKind.RegisteredTitle ? "سجل عيني" : "تقليدي";
                var restrictions = FormatRestrictions(prop);
                d["body"] = ValuationReportNarrativeRules.SpecialAssumptionsBody(
                    hasStructures,
                    deedKindAr,
                    basisLabel,
                    premiseLabel,
                    restrictions);
                break;
            }

            case ValuationReportSectionKeys.Photos:
                d["budget"] = ValuationReportSectionCatalog.PhotoBudgetHint(hasStructures);
                break;

            case ValuationReportSectionKeys.AreaUtilities:
                d["mode"] = hasStructures ? "full_services" : "area_utilities";
                // Buildings print the inspector's actual services; land keeps the
                // 4-field area-utilities framing (11ب) — «لا تُخترع بيانات» when empty.
                d["services"] = inspector.Services.Count > 0
                    ? string.Join(" · ", inspector.Services)
                    : null;
                d["body"] = hasStructures
                    ? "المرافق والخدمات على مستوى العقار والمنطقة — من نتائج المعاينة الميدانية."
                    : "مرافق منطقة الأرض — من نتائج المعاينة الميدانية.";
                break;

            case ValuationReportSectionKeys.Surroundings:
                d["body"] =
                    "المحيط المؤثر (جامع، مرفق طبي، أمني، سوق، حديقة، تعليمي، حكومي، طريق سريع، أخرى) "
                    + "— يُعبَّأ من ملاحظات المعاينة الميدانية عند توفرها.";
                break;

            case ValuationReportSectionKeys.ProfessionalStandards:
            case ValuationReportSectionKeys.Independence:
            case ValuationReportSectionKeys.Restrictions:
            case ValuationReportSectionKeys.Terms:
            case ValuationReportSectionKeys.IvsStandards:
            case ValuationReportSectionKeys.Glossary:
                d["body"] = ValuationReportFrozenTextLayers.ForSectionKey(key)
                    + (complianceRestricted
                       && key == ValuationReportSectionKeys.ProfessionalStandards
                        ? " تنبيه (IVS 106، الفقرة 8-30): توجد قيود مؤثرة غير محسومة"
                          + " (مطابقة الصك على الطبيعة) — لا يُدّعى الامتثال الكامل للمعايير"
                          + " حتى حسمها."
                        : "");
                d["textVersion"] = ValuationReportFrozenTextLayers.VersionId;
                break;
        }

        return d;
    }

    private static string? FormatRestrictions(WorkOrderProperty? prop)
    {
        if (prop is null) return null;
        if (!string.Equals(prop.RestrictionsPresent?.Trim(), "yes", StringComparison.OrdinalIgnoreCase))
            return null;
        var type = prop.RestrictionType?.Trim();
        var other = prop.RestrictionOtherReason?.Trim();
        if (string.IsNullOrWhiteSpace(type) && string.IsNullOrWhiteSpace(other))
            return "موجودة";
        return string.Join(" — ", new[] { type, other }.Where(s => !string.IsNullOrWhiteSpace(s)));
    }

    private static string? JoinBoundary(string? text, string? lengthM)
    {
        if (string.IsNullOrWhiteSpace(text) && string.IsNullOrWhiteSpace(lengthM)) return null;
        if (string.IsNullOrWhiteSpace(lengthM)) return text?.Trim();
        if (string.IsNullOrWhiteSpace(text)) return $"{lengthM} م";
        return $"{text.Trim()} — {lengthM} م";
    }

    private static string BuildPreviewText(
        string key,
        IReadOnlyDictionary<string, string?> fields,
        ValuationReportSectionBodyKind bodyKind)
    {
        if (fields.TryGetValue("body", out var body) && !string.IsNullOrWhiteSpace(body))
            return body!;

        if (bodyKind == ValuationReportSectionBodyKind.FrozenText)
        {
            var frozen = ValuationReportFrozenTextLayers.ForSectionKey(key);
            return string.IsNullOrWhiteSpace(frozen)
                ? "نص ثابت (طبقة معيارية/قانونية) — يُجمَّد برقم نسخة عند الإصدار."
                : frozen;
        }

        if (bodyKind == ValuationReportSectionBodyKind.AttachmentPage)
            return fields.TryGetValue("budget", out var budget) && !string.IsNullOrWhiteSpace(budget)
                ? budget!
                : "حاوية مرفق صفحة كاملة — تُملأ عند التوليد النهائي.";

        var bits = fields
            .Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
            .Select(kv => $"{kv.Key}: {kv.Value}")
            .Take(8)
            .ToList();
        return bits.Count == 0
            ? "بانتظار اكتمال البيانات / القالب المعتمد."
            : string.Join(" · ", bits);
    }
}

/// <summary>
/// Facts extracted from the field inspector's submission payload (single source,
/// decision 10). Loose JSON parse — absent keys stay null («لا تُخترع بيانات»).
/// </summary>
public sealed class InspectorPayloadFacts
{
    public string? BuildState { get; init; }
    public string? OccupancyState { get; init; }
    public string? Movables { get; init; }
    public string? PropertyAgeYears { get; init; }
    public IReadOnlyList<string> Services { get; init; } = [];

    public static InspectorPayloadFacts Parse(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return new InspectorPayloadFacts();
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            if (root.ValueKind != System.Text.Json.JsonValueKind.Object)
                return new InspectorPayloadFacts();

            string? Feature(string key)
            {
                if (root.TryGetProperty("featureValues", out var features)
                    && features.ValueKind == System.Text.Json.JsonValueKind.Object
                    && features.TryGetProperty(key, out var v)
                    && v.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var s = v.GetString();
                    return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
                }

                return null;
            }

            string? Scalar(string key)
            {
                if (!root.TryGetProperty(key, out var v)) return null;
                var s = v.ValueKind switch
                {
                    System.Text.Json.JsonValueKind.String => v.GetString(),
                    System.Text.Json.JsonValueKind.Number => v.GetRawText(),
                    _ => null,
                };
                return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
            }

            var services = new List<string>();
            if (root.TryGetProperty("services", out var svc)
                && svc.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var item in svc.EnumerateArray())
                {
                    if (item.ValueKind == System.Text.Json.JsonValueKind.String
                        && !string.IsNullOrWhiteSpace(item.GetString()))
                    {
                        services.Add(item.GetString()!.Trim());
                    }
                }
            }

            return new InspectorPayloadFacts
            {
                BuildState = Feature("buildState"),
                OccupancyState = Feature("occupancyState"),
                Movables = Feature("movables"),
                PropertyAgeYears = Scalar("propertyAgeYears"),
                Services = services,
            };
        }
        catch (System.Text.Json.JsonException)
        {
            return new InspectorPayloadFacts();
        }
    }
}
