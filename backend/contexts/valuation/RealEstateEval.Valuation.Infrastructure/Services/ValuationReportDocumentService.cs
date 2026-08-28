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
/// Builds the 27-section document outline + live fill for approved-template merge.
/// Letterhead chrome comes from /ejadah/report-template-approved.html (shell public).
/// </summary>
public sealed class ValuationReportDocumentService(
    ValuationDbContext valuation,
    ICaseStudyLookup caseStudy,
    IAttachmentLookup attachments,
    IOrganizationSettingsService organizationSettings,
    IValuationListsService valuationLists,
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
        AssignmentType? assignmentType = null;
        if (Guid.TryParse(propertyId, out var propertyGuid))
        {
            var context = await caseStudy.GetValuationPropertyContextAsync(
                propertyGuid,
                cancellationToken);
            if (context is not null)
            {
                prop = context.ToProperty();
                workspace = context.LatestWorkspace?.ToWorkspace();
                // Building-mode facts come from the inspector's submission (single source).
                inspector = InspectorPayloadFacts.Parse(context.InspectorPayloadJson);
                // client name derives from the registry; report users 0..n.
                clientNameAr = context.ClientNameAr;
                reportUserNames = context.ReportUserClientNamesAr;
                assignmentType = context.AssignmentTypeValue();
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
 // An unresolved deed↔nature match is a material
 // restriction: the standards text must not claim full compliance.
        var complianceRestricted = gates?.Gates
            .Any(g => g.Code == ValuationIssuanceGateCodes.DeedNatureMatch && !g.Passed) == true;
        var org = await organizationSettings.GetAsync(cancellationToken);
        ValuationListsDto? valuationCatalog = null;
        try
        {
            valuationCatalog = await valuationLists.GetAsync(cancellationToken);
        }
        catch
        {
            valuationCatalog = null;
        }

        var marketUsed = (market?.AdoptedCount ?? 0) > 0 || (market?.MarketOpinionValue ?? 0m) > 0m;
        var costUsed = (cost?.CostOpinionWithLand ?? 0m) > 0m
            || (cost?.Lines.Count ?? 0) > 0;
        const bool incomeUsed = false;

        var visible = ValuationReportSectionCatalog.ResolveVisible(
            hasStructures,
            marketUsed,
            costUsed,
            incomeUsed);

        var approachSettings = await valuation.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == vr.Id, cancellationToken);

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var reservedDate = DateOnly.TryParse(vr.RequestDate, out var parsedRequestDate)
            ? parsedRequestDate
            : today;
        var sections = visible.Select(def =>
        {
            var title = ValuationReportSectionCatalog.DisplayTitleAr(def, hasStructures);
            var fields = ValuationReportFieldBuilder.BuildFields(
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
                complianceRestricted,
                approachSettings,
                assignmentType,
                valuationCatalog);
            return new ValuationReportSectionDto
            {
                Number = def.Number,
                Key = def.Key,
                TitleAr = title,
                BodyKind = def.BodyKind.ToString(),
                Included = true,
                PreviewText = ValuationReportFieldBuilder.BuildPreviewText(def.Key, fields, def.BodyKind),
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
                    TransactionCell = ValuationReportFieldBuilder.ComposeTransactionCell(c),
                    AreaSqmDisplay = ValuationReportDisplayRules.FormatMoney(c.AreaSqm),
                    TransactionDateDisplay = ValuationReportFieldBuilder.FormatDateDisplay(c.TransactionDate),
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

 // «لا صفحات لأنواع غير مرفوعة»: attachment sections without uploads drop out.
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
            ReportNumber = ValuationReportNumberRules.FormatReserved(vr.DisplayId, reservedDate),
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
            // قرار 23: نسخة واحدة للحزمة كلها — التمييز داخل التقرير بالموضع والعنوان،
            // ورقم النسخة يوسم الحزمة لا الفقرة؛ المُصدَر مجمّد على نصوصه (لقطة ق-6).
            TextLayerNoteAr =
                $"النصوص المعيارية/القانونية — الحزمة نسخة {org?.ValuationReport?.TextPackageVersion ?? 1} "
                + "(تُجمَّد لحظة الإصدار — قرار 23).",
            TextPackageVersion = org?.ValuationReport?.TextPackageVersion ?? 1,
            ApprovedTemplateUrl = "/ejadah/report-template-approved.html",
            LetterheadImageUrl = string.IsNullOrWhiteSpace(org?.Branding?.LetterheadUrl) ? "/case-study/ejadah-letterhead.png" : org.Branding.LetterheadUrl,
            LetterheadHeadMm = org?.Branding?.LetterheadHeadMm,
            LetterheadFootTopMm = org?.Branding?.LetterheadFootTopMm,
            LetterheadPadMm = org?.Branding?.LetterheadPadMm,
            LetterheadPadStartMm = org?.Branding?.LetterheadPadStartMm,
            StampWidthCm = org?.Branding?.StampWidthCm,
            StampHeightCm = org?.Branding?.StampHeightCm,
            MarketMethodLabelAr = marketUsed ? "طريقة البيوع المقارنة" : "غير مستخدم",
            CostMethodLabelAr = costUsed ? "طريقة المقاول" : "غير مستخدم",
            IncomeMethodLabelAr = "غير مستخدم",
            WeightedPricePerSqmDisplay = market is null ? null : ValuationReportDisplayRules.FormatMoney(market.WeightedPricePerSqm),
            MarketOpinionDisplay = market is null ? null : ValuationReportDisplayRules.FormatMoney(market.MarketOpinionValue),
            SubjectAreaSqmDisplay = market?.SubjectAreaSqm is null ? null : ValuationReportDisplayRules.FormatMoney(market.SubjectAreaSqm.Value),
            LandValueFromMarketDisplay = cost is null ? null : ValuationReportDisplayRules.FormatMoney(cost.LandValueFromMarket),
            CostOpinionWithLandDisplay = cost is null ? null : ValuationReportDisplayRules.FormatMoney(cost.CostOpinionWithLand),
            CostOpinionBuildingsOnlyDisplay = cost is null ? null : ValuationReportDisplayRules.FormatMoney(cost.CostOpinionBuildingsOnly),
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

    public async Task<byte[]?> GetPreviewPdfAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var dto = await GetPreviewAsync(valuationRequestId, cancellationToken);
        return dto is null ? null : ValuationReportPdfGenerator.Generate(dto);
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

        var rows = (await attachments.ListForPropertyAsync(propertyId, actor: null, cancellationToken))
            .OrderBy(a => a.CreatedAtUtc)
            .Take(60)
            .ToList();

        var photoBudget = AttachmentPrintRules.PhotoBudget(hasStructures);

        foreach (var a in rows)
        {
            var typeKey = AttachmentPrintRules.TypeKeyFromScope(a.Scope);
            if (string.IsNullOrWhiteSpace(typeKey))
                continue;

            var section = AttachmentPrintRules.ReportSectionNumber(typeKey);
            if (section is null)
                continue;

            var isImage = a.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
            var dto = new ValuationReportPrintedAttachmentDto
            {
                AttachmentId = a.Id,
                ContentUrl = $"/api/attachments/{a.Id:D}",
                ContentType = a.ContentType,
                DictionaryTypeKey = typeKey,
                LabelAr = AttachmentPrintRules.LabelArForTypeKey(typeKey),
                FileName = a.FileName,
                ReportSectionNumber = section.Value,
                IsImage = isImage,
                CapturedAtDisplay = a.PhotoMetadata?.CapturedAtUtc is { } capUtc
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
}
