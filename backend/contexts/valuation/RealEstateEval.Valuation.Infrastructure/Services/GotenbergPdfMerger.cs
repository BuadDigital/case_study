using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>PDF merge through Gotenberg's PDF engines route (<c>/forms/pdfengines/merge</c>); same host settings as the renderer.</summary>
public sealed class GotenbergPdfMerger(
    HttpClient http,
    IOptions<PdfRendererOptions> options,
    ILogger<GotenbergPdfMerger>? logger = null) : IPdfMerger
{
    public async Task<byte[]> MergeAsync(IReadOnlyList<byte[]> pdfs, CancellationToken cancellationToken = default)
    {
        var baseUrl = (options.Value.BaseUrl ?? "").Trim().TrimEnd('/');
        if (baseUrl.Length == 0)
            throw new HtmlPdfRendererUnavailableException("PdfRenderer:BaseUrl is not configured.");
        if (pdfs.Count == 0)
            throw new HtmlPdfRenderFailedException("Nothing to merge.");

        // Gotenberg merges alphanumerically by file name, so the names carry the order.
        using var form = new MultipartFormDataContent();
        for (var i = 0; i < pdfs.Count; i++)
        {
            var part = new ByteArrayContent(pdfs[i]);
            part.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            form.Add(part, "files", $"{i + 1:D3}.pdf");
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(10, options.Value.TimeoutSeconds)));

        HttpResponseMessage response;
        try
        {
            response = await http.PostAsync($"{baseUrl}/forms/pdfengines/merge", form, timeout.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new HtmlPdfRendererUnavailableException($"PDF merge timed out after {options.Value.TimeoutSeconds}s.");
        }
        catch (HttpRequestException ex)
        {
            throw new HtmlPdfRendererUnavailableException($"PDF service unreachable at {baseUrl}.", ex);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                logger?.LogWarning("Gotenberg answered {Status} for a PDF merge", (int)response.StatusCode);
                if ((int)response.StatusCode >= 500)
                    throw new HtmlPdfRendererUnavailableException($"PDF merge error {(int)response.StatusCode}.");
                throw new HtmlPdfRenderFailedException($"PDF merge rejected the files ({(int)response.StatusCode}).");
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            if (!GotenbergHtmlPdfRenderer.LooksLikePdf(bytes))
                throw new HtmlPdfRenderFailedException("PDF merge returned something that is not a PDF.");
            return bytes;
        }
    }
}
