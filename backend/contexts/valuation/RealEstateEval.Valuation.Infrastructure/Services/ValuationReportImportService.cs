using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using static RealEstateEval.Valuation.Application.Rules.ValuationReportImportRules;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// The valuation-report import (see <see cref="IValuationReportImportService"/>). The file is read
/// twice — once for the preview, once for the commit — so nothing is kept between the two calls.
/// </summary>
public sealed class ValuationReportImportService : IValuationReportImportService
{
    private const int RejectedListLimit = 500;
    private const int LargestGapsShown = 5;
    private const int SaveChunk = 2000;
    private const int BatchListLimit = 100;

    private readonly ValuationDbContext _db;
    private readonly IValuationReportSheetReader _reader;
    private readonly TimeProvider _time;

    public ValuationReportImportService(
        ValuationDbContext db,
        IValuationReportSheetReader reader,
        TimeProvider? time = null)
    {
        _db = db;
        _reader = reader;
        _time = time ?? TimeProvider.System;
    }

    public IReadOnlyList<ValuationReportSourceDto> Sources() =>
        ValuationReportSources.LabelsAr
            .Select(kv => new ValuationReportSourceDto
            {
                Key = kv.Key,
                LabelAr = kv.Value,
                ColumnCount = TemplateFor(kv.Key)?.Count ?? 0,
            })
            .ToList();

    private sealed record ParsedFile(
        IReadOnlyList<TemplateColumn> Template,
        int MatchedColumns,
        List<string> MissingColumns,
        int TotalRows,
        Dictionary<string, ImportedValuationReport> Reports,
        List<RowResult> Rejected,
        DateOnly? FirstApprovedAt,
        DateOnly? LastApprovedAt);

    private (ParsedFile? File, string? Error) Parse(ValuationReportImportRequest request)
    {
        var template = TemplateFor(request.Source);
        if (template is null)
            return (null, "مصدر البيانات غير معروف.");

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(request.ContentBase64);
        }
        catch (FormatException)
        {
            return (null, "تعذّر قراءة الملف المرفوع.");
        }

        var sheet = _reader.Read(bytes);
        if (sheet is null)
            return (null, "الملف ليس ملف Excel صالحًا (xlsx).");

        var (columns, missing) = MatchColumns(template, sheet.Value.Header);
        var reports = new Dictionary<string, ImportedValuationReport>(StringComparer.Ordinal);
        var rejected = new List<RowResult>();
        DateOnly? first = null, last = null;
        var total = 0;
        foreach (var row in sheet.Value.Rows)
        {
            if (row.All(c => c is null || (c is string s && string.IsNullOrWhiteSpace(s))))
                continue;
            total++;
            var result = ReadRow(request.Source, columns, row);
            if (result.ApprovedAt is { } at)
            {
                if (first is null || at < first) first = at;
                if (last is null || at > last) last = at;
            }
            if (result.Report is null)
                rejected.Add(result);
            else
                reports[result.Report.ReportNumber] = result.Report; // A number twice in a file: the later row wins.
        }

        if (total == 0)
            return (null, "الملف لا يحتوي على أي سجلات.");

        return (new ParsedFile(template, columns.Count, missing, total, reports, rejected, first, last), null);
    }

    public async Task<(ValuationReportImportPreviewDto? Result, string? Error)> PreviewAsync(
        ValuationReportImportRequest request,
        CancellationToken cancellationToken = default)
    {
        var (file, error) = Parse(request);
        if (file is null) return (null, error);

        var existing = await ExistingNumbersAsync(request.Source, cancellationToken);
        var replaced = file.Reports.Keys.Count(existing.Contains);
        var previous = await LatestBatchAsync(request.Source, cancellationToken);

        var numbers = file.Reports.Values.Select(r => r.ReportNumberValue).ToList();
        var width = file.Reports.Keys.Select(k => k.Length).DefaultIfEmpty(6).Max();
        var gaps = InternalGaps(numbers);

        ValuationReportPreviousGapDto? previousGap = null;
        if (previous is not null && numbers.Count > 0)
        {
            var fileMin = numbers.Min();
            var missing = GapAfterPreviousUpload(previous.MaxReportNumberValue, fileMin);
            if (missing > 0)
            {
                previousGap = new ValuationReportPreviousGapDto
                {
                    LastNumber = previous.MaxReportNumber,
                    LastImportedAtUtc = previous.ImportedAtUtc,
                    FirstNumber = PadNumber(fileMin, width),
                    MissingCount = missing,
                };
            }
        }

        return (new ValuationReportImportPreviewDto
        {
            Source = request.Source,
            FileName = request.FileName,
            TotalRows = file.TotalRows,
            FirstApprovedAt = file.FirstApprovedAt,
            LastApprovedAt = file.LastApprovedAt,
            MatchedColumns = file.MatchedColumns,
            RequiredColumns = file.Template.Count,
            MissingColumns = file.MissingColumns,
            NewCount = file.Reports.Count - replaced,
            ReplacedCount = replaced,
            RejectedCount = file.Rejected.Count,
            NoValueCount = file.Reports.Values.Count(r => r.FinalValue is null),
            Rejected = file.Rejected
                .Take(RejectedListLimit)
                .Select(r => new ValuationReportRejectedRowDto
                {
                    ReportNumber = r.ReportNumber,
                    PropertyType = r.PropertyType,
                    ApprovedAt = r.ApprovedAt,
                    ReasonAr = r.RejectReasonAr!,
                })
                .ToList(),
            HasPreviousBatch = previous is not null,
            PreviousBatchGap = previousGap,
            InternalMissingCount = gaps.Sum(g => g.Count),
            InternalGapCount = gaps.Count,
            LargestInternalGaps = gaps
                .OrderByDescending(g => g.Count)
                .Take(LargestGapsShown)
                .Select(g => new ValuationReportNumberGapDto
                {
                    From = PadNumber(g.From, width),
                    To = PadNumber(g.To, width),
                    Count = g.Count,
                })
                .ToList(),
        }, null);
    }

    public async Task<(ValuationReportImportBatchDto? Result, string? Error)> CommitAsync(
        ValuationReportImportRequest request,
        string actorUserId,
        string? actorName,
        CancellationToken cancellationToken = default)
    {
        var (file, error) = Parse(request);
        if (file is null) return (null, error);
        if (file.MissingColumns.Count > 0)
            return (null, "أعمدة إلزامية ناقصة في الملف: " + string.Join("، ", file.MissingColumns));

        var now = _time.GetUtcNow().UtcDateTime;
        var batch = new ValuationReportImportBatch
        {
            Id = Guid.NewGuid(),
            Source = request.Source,
            FileName = request.FileName,
            ImportedByUserId = actorUserId,
            ImportedByName = actorName,
            ImportedAtUtc = now,
            TotalRows = file.TotalRows,
            RejectedCount = file.Rejected.Count,
        };

        var newCount = 0;
        var replacedCount = 0;
        foreach (var chunk in file.Reports.Values.Chunk(SaveChunk))
        {
            var numbers = chunk.Select(r => r.ReportNumber).ToList();
            var tracked = await _db.ImportedValuationReports
                .Where(r => r.Source == request.Source && numbers.Contains(r.ReportNumber))
                .ToDictionaryAsync(r => r.ReportNumber, StringComparer.Ordinal, cancellationToken);

            foreach (var incoming in chunk)
            {
                incoming.ImportBatchId = batch.Id;
                incoming.ImportedAtUtc = now;
                if (tracked.TryGetValue(incoming.ReportNumber, out var row))
                {
                    incoming.Id = row.Id;
                    _db.Entry(row).CurrentValues.SetValues(incoming);
                    replacedCount++;
                }
                else
                {
                    incoming.Id = Guid.NewGuid();
                    _db.ImportedValuationReports.Add(incoming);
                    newCount++;
                }
            }
            await _db.SaveChangesAsync(cancellationToken);
            _db.ChangeTracker.Clear();
        }

        var max = file.Reports.Values.MaxBy(r => r.ReportNumberValue);
        batch.NewCount = newCount;
        batch.ReplacedCount = replacedCount;
        batch.MaxReportNumberValue = max?.ReportNumberValue ?? 0;
        batch.MaxReportNumber = max?.ReportNumber ?? "";
        _db.ValuationReportImportBatches.Add(batch);
        await _db.SaveChangesAsync(cancellationToken);

        return (ToDto(batch), null);
    }

    public async Task<IReadOnlyList<ValuationReportImportBatchDto>> ListBatchesAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.ValuationReportImportBatches.AsNoTracking()
            .OrderByDescending(b => b.ImportedAtUtc)
            .Take(BatchListLimit)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<ValuationReportMapPointDto>> ListMapPointsAsync(
        CancellationToken cancellationToken = default) =>
        await _db.ImportedValuationReports.AsNoTracking()
            .Select(r => new ValuationReportMapPointDto
            {
                Source = r.Source,
                ReportNumber = r.ReportNumber,
                Latitude = r.Latitude,
                Longitude = r.Longitude,
                PropertyType = r.PropertyType,
                Usage = r.Usage,
                ValuationDate = r.ValuationDate,
            })
            .ToListAsync(cancellationToken);

    public async Task<ValuationReportDetailDto?> GetAsync(
        string source,
        string reportNumber,
        CancellationToken cancellationToken = default)
    {
        var r = await _db.ImportedValuationReports.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Source == source && x.ReportNumber == reportNumber, cancellationToken);
        return r is null
            ? null
            : new ValuationReportDetailDto
            {
                Source = r.Source,
                SourceLabelAr = ValuationReportSources.LabelAr(r.Source),
                ReportNumber = r.ReportNumber,
                Template = r.Template,
                Approver = r.Approver,
                ApprovedAt = r.ApprovedAt,
                Client = r.Client,
                DeedNumber = r.DeedNumber,
                PropertyType = r.PropertyType,
                Inspector = r.Inspector,
                Usage = r.Usage,
                LandArea = r.LandArea,
                FinalValue = r.FinalValue,
                InspectionAuditor = r.InspectionAuditor,
                ValuationDate = r.ValuationDate,
            };
    }

    private async Task<HashSet<string>> ExistingNumbersAsync(string source, CancellationToken ct)
    {
        var numbers = await _db.ImportedValuationReports.AsNoTracking()
            .Where(r => r.Source == source)
            .Select(r => r.ReportNumber)
            .ToListAsync(ct);
        return numbers.ToHashSet(StringComparer.Ordinal);
    }

    private Task<ValuationReportImportBatch?> LatestBatchAsync(string source, CancellationToken ct) =>
        _db.ValuationReportImportBatches.AsNoTracking()
            .Where(b => b.Source == source)
            .OrderByDescending(b => b.ImportedAtUtc)
            .FirstOrDefaultAsync(ct);

    private static ValuationReportImportBatchDto ToDto(ValuationReportImportBatch b) => new()
    {
        Id = b.Id,
        Source = b.Source,
        SourceLabelAr = ValuationReportSources.LabelAr(b.Source),
        FileName = b.FileName,
        ImportedByName = b.ImportedByName,
        ImportedAtUtc = b.ImportedAtUtc,
        NewCount = b.NewCount,
        ReplacedCount = b.ReplacedCount,
        RejectedCount = b.RejectedCount,
    };
}
