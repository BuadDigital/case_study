using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// Imports valuation reports from an external program's periodic Excel export and serves them to
/// the map. Preview reads the file without saving; commit reads it again and upserts by
/// (source, report number) — the same file body goes to both.
/// </summary>
public interface IValuationReportImportService
{
    IReadOnlyList<ValuationReportSourceDto> Sources();

    /// <summary>The preview, or an Arabic error (unknown source, unreadable file, empty sheet).</summary>
    Task<(ValuationReportImportPreviewDto? Result, string? Error)> PreviewAsync(
        ValuationReportImportRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>The saved batch, or an Arabic error (as preview, plus a missing required column).</summary>
    Task<(ValuationReportImportBatchDto? Result, string? Error)> CommitAsync(
        ValuationReportImportRequest request,
        string actorUserId,
        string? actorName,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ValuationReportImportBatchDto>> ListBatchesAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ValuationReportMapPointDto>> ListMapPointsAsync(
        CancellationToken cancellationToken = default);

    Task<ValuationReportDetailDto?> GetAsync(
        string source,
        string reportNumber,
        CancellationToken cancellationToken = default);
}

/// <summary>Reads the first sheet of an Excel file into a header row and value rows.</summary>
public interface IValuationReportSheetReader
{
    /// <summary>Null when the bytes are not a readable Excel workbook.</summary>
    (IReadOnlyList<string?> Header, IReadOnlyList<object?[]> Rows)? Read(byte[] content);
}
