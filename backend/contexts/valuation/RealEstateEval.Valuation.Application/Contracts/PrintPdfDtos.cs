namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>
/// A print page the browser built (for example the issued case-study report), to be turned into a PDF.
/// The HTML must be self-contained — images, styles and fonts as data URLs — because the renderer has
/// no network access.
/// </summary>
public class RenderPrintPdfRequest
{
    public string Html { get; init; } = "";
}
