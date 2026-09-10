using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>Config section <c>PdfRenderer</c>.</summary>
public sealed class PdfRendererOptions
{
 /// <summary>Gotenberg base URL, e.g. <c>http://gotenberg:3000</c>. Empty disables PDF links (503).</summary>
    public string? BaseUrl { get; set; }

 /// <summary>Per-render HTTP timeout. Gotenberg's own <c>--api-timeout</c> should be at least this.</summary>
    public int TimeoutSeconds { get; set; } = 120;
}

/// <summary>
/// HTML → PDF through Gotenberg's Chromium route (<c>/forms/chromium/convert/html</c>).
/// The document must be self-contained (data URLs): the container runs with an http(s)
/// deny list so rendered pages cannot reach internal services.
/// </summary>
public sealed class GotenbergHtmlPdfRenderer(
    HttpClient http,
    IOptions<PdfRendererOptions> options,
    ILogger<GotenbergHtmlPdfRenderer>? logger = null) : IHtmlPdfRenderer
{
    public const string RendererName = "gotenberg-chromium";

 /// <summary>A4 in inches — Gotenberg's paper unit.</summary>
    private const string A4WidthIn = "8.27";
    private const string A4HeightIn = "11.69";

    public string Name => RendererName;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.Value.BaseUrl);

    public async Task<byte[]> RenderAsync(string html, CancellationToken cancellationToken = default)
    {
        var baseUrl = (options.Value.BaseUrl ?? "").Trim().TrimEnd('/');
        if (baseUrl.Length == 0)
            throw new HtmlPdfRendererUnavailableException("PdfRenderer:BaseUrl is not configured.");

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(html));
        file.Headers.ContentType = new MediaTypeHeaderValue("text/html") { CharSet = "utf-8" };
        form.Add(file, "files", "index.html");
        AddField(form, "paperWidth", A4WidthIn);
        AddField(form, "paperHeight", A4HeightIn);
        AddField(form, "marginTop", "0");
        AddField(form, "marginBottom", "0");
        AddField(form, "marginLeft", "0");
        AddField(form, "marginRight", "0");
        AddField(form, "printBackground", "true");
        AddField(form, "preferCssPageSize", "true");
        AddField(form, "emulatedMediaType", "print");
        // Embedded @font-face data URLs: print only after the font set settled (status is
        // "loaded" also when nothing is loading, so this never blocks a font-less document).
        AddField(form, "waitForExpression", "document.fonts.status === 'loaded'");
        AddField(form, "failOnConsoleExceptions", "false");

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(10, options.Value.TimeoutSeconds)));

        HttpResponseMessage response;
        try
        {
            response = await http.PostAsync($"{baseUrl}/forms/chromium/convert/html", form, timeout.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new HtmlPdfRendererUnavailableException(
                $"PDF renderer timed out after {options.Value.TimeoutSeconds}s.");
        }
        catch (HttpRequestException ex)
        {
            throw new HtmlPdfRendererUnavailableException($"PDF renderer unreachable at {baseUrl}.", ex);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                var body = await SafeReadTextAsync(response, cancellationToken);
                logger?.LogWarning(
                    "Gotenberg answered {Status} for a report render: {Body}",
                    (int)response.StatusCode,
                    body);
                if ((int)response.StatusCode >= 500)
                    throw new HtmlPdfRendererUnavailableException($"PDF renderer error {(int)response.StatusCode}.");
                throw new HtmlPdfRenderFailedException($"PDF renderer rejected the document ({(int)response.StatusCode}): {body}");
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            if (!LooksLikePdf(bytes))
                throw new HtmlPdfRenderFailedException("PDF renderer returned something that is not a PDF.");
            return bytes;
        }
    }

    internal static bool LooksLikePdf(byte[] bytes) =>
        bytes.Length > 5
        && bytes[0] == (byte)'%'
        && bytes[1] == (byte)'P'
        && bytes[2] == (byte)'D'
        && bytes[3] == (byte)'F';

    private static void AddField(MultipartFormDataContent form, string name, string value) =>
        form.Add(new StringContent(value), name);

    private static async Task<string> SafeReadTextAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            return text.Length > 300 ? text[..300] : text;
        }
        catch
        {
            return "";
        }
    }
}
