using RealEstateEval.Valuation.Application.Services;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>Signs and verifies the <c>k</c> query key of public report PDF links.</summary>
public interface IReportLinkSigner
{
 /// <summary>How long a freshly issued link stays valid.</summary>
    TimeSpan Lifetime { get; }

    string Sign(Guid pdfId, string fileName, DateTimeOffset expiresAt);

 /// <summary>Null on any mismatch (structure, signature, expiry).</summary>
    ReportLinkToken.Parsed? Verify(string? token, string fileName, DateTimeOffset now);
}
