using System.Text;

namespace RealEstateEval.Application.Tests;

/// <summary>Minimal PDFs for the deposit certificate rules (header + page objects are all they read).</summary>
internal static class TestPdf
{
    public static readonly byte[] OnePage = Build(1);
    public static readonly byte[] TwoPages = Build(2);

    public static string OnePageBase64 => Convert.ToBase64String(OnePage);

    private static byte[] Build(int pages)
    {
        var text = new StringBuilder("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n");
        text.Append($"2 0 obj<</Type/Pages/Count {pages}>>endobj\n");
        for (var i = 0; i < pages; i++)
            text.Append($"{3 + i} 0 obj<</Type/Page/Parent 2 0 R>>endobj\n");
        text.Append("trailer<</Root 1 0 R>>\n%%EOF");
        return Encoding.ASCII.GetBytes(text.ToString());
    }
}
