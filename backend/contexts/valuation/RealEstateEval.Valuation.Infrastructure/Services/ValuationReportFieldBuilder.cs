using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Attachments.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// بناء حقول أقسام تقرير التقييم ونص المعاينة — دوال نقية منقولة من خدمة المستند.
/// </summary>
internal static class ValuationReportFieldBuilder
{
    public static string ComposeTransactionCell(ComparablePropertyDto c)
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

    public static string FormatDateDisplay(string ymd)
    {
        if (DateOnly.TryParse(ymd, out var d))
            return ValuationReportDisplayRules.FormatGregorianDate(d);
        return ymd;
    }

    public static string? FormatRetrospectiveDateDisplay(ValuationApproachSettings? settings)
    {
        if (settings?.RetrospectiveDate is not { } start) return null;
        var startText = ValuationReportDisplayRules.FormatGregorianDate(start);
        if (settings.RetrospectiveDateEnd is not { } end) return startText;
        return $"{startText} — {ValuationReportDisplayRules.FormatGregorianDate(end)}";
    }

    public static IReadOnlyDictionary<string, string?> BuildFields(
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
        bool complianceRestricted = false,
        ValuationApproachSettings? approachSettings = null,
        AssignmentType? assignmentType = null,
        ValuationListsDto? valuationCatalog = null)
    {
        inspector ??= new InspectorPayloadFacts();
        var d = new Dictionary<string, string?>(StringComparer.Ordinal);
        var adopted = (market?.Items ?? []).Where(i => i.IsAdopted).OrderBy(i => i.SortOrder).ToList();
        var basisLabel = !string.IsNullOrWhiteSpace(recon?.BasisOfValueLabelAr)
            ? recon!.BasisOfValueLabelAr
            : assignmentType is { } assignedType
                ? AssignmentValuationDefaults.BasisOfValueLabelAr(assignedType)
                : BasisOfValueKeys.LabelAr(recon?.BasisOfValueKey ?? BasisOfValueKeys.Market);
        var premiseLabel = !string.IsNullOrWhiteSpace(recon?.ValuePremiseLabelAr)
            ? recon!.ValuePremiseLabelAr
            : assignmentType is { } assignedPremiseType
                ? AssignmentValuationDefaults.PremiseLabelAr(assignedPremiseType)
                : ValuePremiseKeys.LabelAr(recon?.ValuePremiseKey);

        switch (key)
        {
            case ValuationReportSectionKeys.ValuerIdentity:
                d["name"] = org.Evaluator.Name;
                d["licenseNumber"] = org.Evaluator.LicenseNumber;
                d["membershipNumber"] = org.Evaluator.MembershipNumber;
                d["licenseIssuedAt"] = org.Evaluator.LicenseIssuedAt;
                d["licenseExpiresHijri"] = org.Evaluator.LicenseExpiresHijri;
                d["licenseExpiresAt"] = ValuationReportDisplayRules.FormatIsoDateString(
                    org.Evaluator.LicenseExpiresAt);
                d["membershipExpiresAt"] = ValuationReportDisplayRules.FormatIsoDateString(
                    org.Evaluator.MembershipExpiresAt);
                d["title"] = org.Evaluator.Title;
                d["membershipCategory"] = org.Evaluator.MembershipCategory;
                d["branch"] = ValuationReportSettingsDefaults.Clip(
                    org.ValuationReport.ValuationBranch,
                    ValuationReportSettingsDefaults.ValuationBranch,
                    200);
                break;

            case ValuationReportSectionKeys.KeyInputs:
                d["basis"] = basisLabel;
                d["premise"] = premiseLabel;
                d["currency"] = ValuationReportSettingsDefaults.Clip(
                    org.ValuationReport.Currency, ValuationReportSettingsDefaults.Currency, 200);
                d["reportType"] = ValuationReportSettingsDefaults.Clip(
                    org.ValuationReport.ReportType, ValuationReportSettingsDefaults.ReportType, 200);
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
                d["body"] = FrozenFromOrg(org, key, valuationCatalog);
                break;

            case ValuationReportSectionKeys.ScopeOfWork:
                d["displayId"] = vr.DisplayId;
                d["propertyType"] = prop?.PropertyType ?? vr.PropertyType;
                d["area"] = prop?.Area ?? vr.Area;
                d["reportType"] = ValuationReportSettingsDefaults.Clip(
                    org.ValuationReport.ReportType, ValuationReportSettingsDefaults.ReportType, 200);
                d["currency"] = ValuationReportSettingsDefaults.Clip(
                    org.ValuationReport.Currency, ValuationReportSettingsDefaults.Currency, 200);
                d["basis"] = basisLabel;
                d["premise"] = premiseLabel;
                d["purpose"] = assignmentType is { } purposeType
                    ? AssignmentValuationDefaults.PurposeLabelAr(purposeType)
                    : approachSettings is null
                        || string.IsNullOrWhiteSpace(approachSettings.ValuationPurposeKey)
                        ? null
                        : ValuationPurposeKeys.LabelAr(approachSettings.ValuationPurposeKey)
                          + (string.IsNullOrWhiteSpace(approachSettings.ValuationPurposeNote)
                              ? ""
                              : $" — {approachSettings.ValuationPurposeNote}");
 // تاريخ التقييم بنوعيه: إصدار القيمة (آلي = تاريخ التقرير) أو أثر رجعي يدوي.
                d["valuationDateMode"] = ValuationDateModes.LabelAr(
                    approachSettings?.ValuationDateMode);
                d["valuationDate"] = FormatRetrospectiveDateDisplay(approachSettings);
 // client from the registry + report users + derived usage sentence.
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
 // نوع الملكية field in section 6 — editable-derived.
                d["ownershipType"] = prop is null
                    ? null
                    : OwnershipTypes.LabelAr(OwnershipTypeRules.Effective(
                        prop.OwnershipTypeIsManual,
                        prop.OwnershipType,
                        OwnershipTypeRules.ParseOwners(prop.DeedOwnersJson),
                        prop.RestrictionType));
                d["hasStructures"] = hasStructures ? "yes" : "no";
 // حالة العقار prints for buildings only, deleted for land;
 // source is the field inspector (بند «حالة البناء»).
                d["propertyCondition"] = hasStructures ? inspector.BuildState : null;
 // المنقولات وصف حر من الميداني؛ الغياب يُدوَّن نفيًا.
                d["movables"] = inspector.Movables switch
                {
                    "نعم" => string.IsNullOrWhiteSpace(inspector.MovablesDescription)
                        ? "يوجد منقولات بالعقار (وفق معاينة الميداني)"
                        : inspector.MovablesDescription,
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
                d["propertyDescription"] = inspector.PropertyDescription;
                d["roomCount"] = inspector.RoomCount;
                d["hallCount"] = inspector.HallCount;
                d["bathroomCount"] = inspector.BathroomCount;
                d["hasElevator"] = inspector.HasElevator;
                d["hasPool"] = inspector.HasPool;
                d["hasAnnex"] = inspector.HasAnnex;
                d["annexTotal"] = inspector.AnnexTotal;
                d["kitchen"] = inspector.Kitchen;
                d["defects"] = inspector.Observations;
                d["city"] = prop?.City;
                d["district"] = prop?.District;
                break;

            case ValuationReportSectionKeys.LocationDetails:
                d["region"] = prop?.Region;
                d["city"] = prop?.City;
                d["district"] = prop?.District;
                d["buildingAge"] = hasStructures ? inspector.PropertyAgeYears : null;
                d["occupancyState"] = hasStructures ? inspector.OccupancyState : null;
                d["latitude"] = inspector.MapLatitude;
                d["longitude"] = inspector.MapLongitude;
                d["planNumber"] = prop?.PlanNumber;
                d["planName"] = prop?.PlanName;
                d["plotNumber"] = prop?.PlotNumber;
                d["blockNumber"] = prop?.BlockNumber;
                d["partitionMinutes"] = string.Join(" · ", new[] { prop?.PartitionMinutesNumber, prop?.PartitionMinutesDate }.Where(s => !string.IsNullOrWhiteSpace(s)));
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
 // the renderer switches the adjusted-amount column label on this.
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
            {
                var frozen = FrozenFromOrg(org, key, valuationCatalog);
                var live = ValuationReportNarrativeRules.ResearchScopeBody(
                    adopted.Select(i => i.Comparable.Source).ToList(),
                    adopted.Count);
                d["body"] = string.IsNullOrWhiteSpace(live) ? frozen : frozen + "\n\n" + live;
                d["adoptedCount"] = adopted.Count.ToString();
                break;
            }

            case ValuationReportSectionKeys.SpecialAssumptions:
            {
                var deedKindAr = prop is null
                    ? null
                    : prop.DeedKind == DeedKind.RegisteredTitle ? "سجل عيني" : "تقليدي";
                var restrictions = FormatRestrictions(prop);
                var inspectionReservation = prop is null
                    ? null
                    : InspectionLimitsRules.ComposeReservationTextAr(
                        prop.InspectionScopeKey,
                        prop.InspectionRestrictionReason,
                        InspectionLimitsRules.ParseUnits(prop.UninspectedUnitsJson));
                var retrospectiveLine =
                    approachSettings?.ValuationDateMode == ValuationDateModes.Retrospective
                    && approachSettings.RetrospectiveDate is { } retroDate
                        ? "قُيّم العقار بأثر رجعي "
                          + (
                              approachSettings.RetrospectiveDateEnd is { } retroEnd
                                  ? $"للفترة من {ValuationReportDisplayRules.FormatGregorianDate(retroDate)} إلى {ValuationReportDisplayRules.FormatGregorianDate(retroEnd)}"
                                  : $"بتاريخ {ValuationReportDisplayRules.FormatGregorianDate(retroDate)}"
                            )
                          + (string.IsNullOrWhiteSpace(approachSettings.RetrospectiveRationale)
                              ? "."
                              : $"؛ المبرر: {approachSettings.RetrospectiveRationale}.")
                        : null;
                d["body"] = ValuationReportNarrativeRules.SpecialAssumptionsBody(
                    hasStructures,
                    deedKindAr,
                    basisLabel,
                    premiseLabel,
                    restrictions,
                    inspectionReservation,
                    approachSettings?.ExternalSpecialistUsed ?? false,
                    approachSettings?.ExternalSpecialistDetails,
                    ValuationApproachSettingsRules.ParseAssumptions(
                        approachSettings?.SelectedAssumptionsJson),
                    retrospectiveLine);
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
                d["electricityMeters"] = inspector.ElectricityMeterCount;
                d["electricityMeterNumbers"] = inspector.ElectricityMeterNumbers;
                d["waterMeters"] = inspector.WaterMeterCount;
                d["waterMeterNumbers"] = inspector.WaterMeterNumbers;
                d["body"] = hasStructures
                    ? "المرافق والخدمات على مستوى العقار والمنطقة — من نتائج المعاينة الميدانية."
                    : "مرافق منطقة الأرض — من نتائج المعاينة الميدانية.";
                break;

            case ValuationReportSectionKeys.Surroundings:
                d["amenities"] = inspector.Amenities.Count > 0
                    ? string.Join(" · ", inspector.Amenities)
                    : null;
                d["body"] =
                    inspector.Amenities.Count > 0
                        ? string.Join(" · ", inspector.Amenities)
                        : "المحيط المؤثر — يُعبَّأ من ملاحظات المعاينة الميدانية عند توفرها.";
                break;

            case ValuationReportSectionKeys.ProfessionalStandards:
            case ValuationReportSectionKeys.Independence:
            case ValuationReportSectionKeys.Restrictions:
            case ValuationReportSectionKeys.Terms:
            case ValuationReportSectionKeys.IvsStandards:
            case ValuationReportSectionKeys.Glossary:
                d["body"] = FrozenFromOrg(org, key, valuationCatalog)
                    + (complianceRestricted
                       && key == ValuationReportSectionKeys.ProfessionalStandards
                        ? " تنبيه: توجد قيود مؤثرة غير محسومة"
                          + " (مطابقة الصك على الطبيعة) — لا يُدّعى الامتثال الكامل للمعايير"
                          + " حتى حسمها."
                        : "");
                d["textVersion"] =
                    $"حزمة النصوص نسخة {org.ValuationReport?.TextPackageVersion ?? 1} (قرار 23)";
                break;
        }

        return d;
    }

    public static string FrozenFromOrg(
        OrganizationSettingsDto org,
        string key,
        ValuationListsDto? lists)
    {
        if (key == ValuationReportSectionKeys.IvsStandards)
        {
            var fromList = FormatEnabledList(lists, ValuationListIds.IvsStandards);
            if (fromList.Length > 0)
            {
                var date = string.IsNullOrWhiteSpace(lists?.IvsEffectiveDate)
                    ? ""
                    : $"تاريخ سريان المعايير: {lists!.IvsEffectiveDate}\n";
                return date + fromList;
            }
        }

        if (key == ValuationReportSectionKeys.Glossary)
        {
            var fromList = FormatEnabledList(lists, ValuationListIds.Glossary);
            if (fromList.Length > 0)
                return fromList;
        }

        var vr = org.ValuationReport;
        var saved = key switch
        {
            ValuationReportSectionKeys.KeyInputs => vr.KeyInputsText,
            ValuationReportSectionKeys.ProfessionalStandards => vr.ProfessionalStandards,
            ValuationReportSectionKeys.Independence => vr.Independence,
            ValuationReportSectionKeys.ResearchScope => vr.ResearchScopeText,
            ValuationReportSectionKeys.Restrictions => vr.Restrictions,
            ValuationReportSectionKeys.Terms => vr.Terms,
            ValuationReportSectionKeys.IvsStandards => vr.IvsStandards,
            ValuationReportSectionKeys.Glossary => vr.Glossary,
            _ => "",
        };
        var clipped = ValuationReportSettingsDefaults.Clip(
            saved, ValuationReportSettingsDefaults.ForSectionKey(key));
        if (key == ValuationReportSectionKeys.ProfessionalStandards)
        {
            var date = string.IsNullOrWhiteSpace(lists?.IvsEffectiveDate)
                ? "31 يناير 2025"
                : lists!.IvsEffectiveDate.Trim();
            clipped = clipped.Replace("{{ivsDate}}", date, StringComparison.Ordinal);
        }
        return clipped;
    }

    public static string FormatEnabledList(ValuationListsDto? lists, string listId)
    {
        if (lists?.Lists is null || !lists.Lists.TryGetValue(listId, out var rows) || rows is null)
            return "";
        return string.Join(
            "\n",
            rows.Where(x => x.IsEnabled)
                .OrderBy(x => x.SortOrder)
                .Select(x =>
                {
                    var extra = x.Cells.FirstOrDefault();
                    return string.IsNullOrWhiteSpace(extra) ? x.Name : $"{x.Name} — {extra}";
                }));
    }

    public static string? FormatRestrictions(WorkOrderProperty? prop)
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

    public static string? JoinBoundary(string? text, string? lengthM)
    {
        if (string.IsNullOrWhiteSpace(text) && string.IsNullOrWhiteSpace(lengthM)) return null;
        if (string.IsNullOrWhiteSpace(lengthM)) return text?.Trim();
        if (string.IsNullOrWhiteSpace(text)) return $"{lengthM} م";
        return $"{text.Trim()} — {lengthM} م";
    }

    public static string BuildPreviewText(
        string key,
        IReadOnlyDictionary<string, string?> fields,
        ValuationReportSectionBodyKind bodyKind)
    {
        if (fields.TryGetValue("body", out var body) && !string.IsNullOrWhiteSpace(body))
            return body!;

        if (bodyKind == ValuationReportSectionBodyKind.FrozenText)
        {
            var frozen = ValuationReportSettingsDefaults.ForSectionKey(key);
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
