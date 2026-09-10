namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>Turns a self-contained HTML document into PDF bytes (A4, CSS-driven page breaks).</summary>
public interface IHtmlPdfRenderer
{
 /// <summary>Renderer id stored with the PDF, e.g. "gotenberg-chromium".</summary>
    string Name { get; }

 /// <summary>True when a renderer endpoint is configured for this host.</summary>
    bool IsConfigured { get; }

 /// <exception cref="HtmlPdfRendererUnavailableException">Renderer not configured or unreachable.</exception>
 /// <exception cref="HtmlPdfRenderFailedException">Renderer answered but produced no valid PDF.</exception>
    Task<byte[]> RenderAsync(string html, CancellationToken cancellationToken = default);
}

public class HtmlPdfRendererUnavailableException(string message, Exception? inner = null)
    : Exception(message, inner);

public class HtmlPdfRenderFailedException(string message, Exception? inner = null)
    : Exception(message, inner);
