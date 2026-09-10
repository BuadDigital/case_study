using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class ValuationReportPdfServiceTests
{
    private static readonly DateTimeOffset Start = new(2026, 9, 9, 10, 0, 0, TimeSpan.Zero);
    private const string Html = "<!DOCTYPE html><html dir=\"rtl\"><body><section class=\"page pg\"><h1>تقرير التقييم</h1></section></body></html>";

    [Fact]
    public async Task Create_renders_stores_and_returns_a_link_that_opens_the_pdf()
    {
        var (db, requestId) = await SeedAsync();
        var renderer = new FakeRenderer();
        var signer = Signer();
        var clock = new TestClock(Start);
        var service = new ValuationReportPdfService(db, renderer, signer, clock);

        var result = await service.CreateFromHtmlAsync(
            requestId,
            new CreateValuationReportPdfRequest { Html = Html, ReportNumber = "051421" },
            "user-1");

        Assert.Equal(ValuationReportPdfFailure.None, result.Failure);
        var link = result.Link!;
        Assert.Equal("051421.pdf", link.FileName);
        Assert.Equal("051421", link.ReportNumber);
        Assert.StartsWith("/api/valuation-reports/051421.pdf?k=", link.Url);
        Assert.Equal(FakeRenderer.Pdf.Length, link.SizeBytes);
        Assert.Equal(Convert.ToHexStringLower(SHA256.HashData(FakeRenderer.Pdf)), link.Sha256);
        Assert.Equal(Start.AddDays(90).UtcDateTime.ToString("O"), link.ExpiresAtUtc);
        Assert.Equal(Html, renderer.LastHtml);

        var stored = await db.ValuationReportPdfs.SingleAsync();
        Assert.Equal("user-1", stored.CreatedByUserId);
        Assert.Equal("fake-renderer", stored.Renderer);
        Assert.Equal(FakeRenderer.Pdf, stored.Content);

        var key = link.Url[(link.Url.IndexOf("k=", StringComparison.Ordinal) + 2)..];
        var opened = await service.OpenSharedAsync("051421.pdf", key);
        Assert.NotNull(opened);
        Assert.Equal(FakeRenderer.Pdf, opened.Content);
        Assert.Equal(stored.Sha256, opened.Sha256);

        // Same key, other file name → nothing.
        Assert.Null(await service.OpenSharedAsync("051422.pdf", key));
        // Expired → nothing.
        clock.Advance(TimeSpan.FromDays(91));
        Assert.Null(await service.OpenSharedAsync("051421.pdf", key));
    }

    [Fact]
    public async Task Latest_link_points_at_the_newest_copy_and_retention_keeps_three()
    {
        var (db, requestId) = await SeedAsync();
        var clock = new TestClock(Start);
        var service = new ValuationReportPdfService(db, new FakeRenderer(), Signer(), clock);

        Assert.Null(await service.GetLatestLinkAsync(requestId));

        var links = new List<ValuationReportPdfLinkDto>();
        for (var i = 1; i <= 5; i++)
        {
            clock.Advance(TimeSpan.FromMinutes(1));
            var r = await service.CreateFromHtmlAsync(
                requestId,
                new CreateValuationReportPdfRequest { Html = Html, ReportNumber = $"R-{i}" },
                null);
            links.Add(r.Link!);
        }

        var kept = await db.ValuationReportPdfs.OrderBy(x => x.CreatedAtUtc).Select(x => x.ReportNumber).ToListAsync();
        Assert.Equal(new[] { "R-3", "R-4", "R-5" }, kept);

        var latest = await service.GetLatestLinkAsync(requestId);
        Assert.NotNull(latest);
        Assert.Equal("R-5.pdf", latest.FileName);
        Assert.Equal(links[4].PdfId, latest.PdfId);

        // A pruned copy's link no longer resolves; a kept one still does.
        var oldKey = links[0].Url[(links[0].Url.IndexOf("k=", StringComparison.Ordinal) + 2)..];
        Assert.Null(await service.OpenSharedAsync("R-1.pdf", oldKey));
        var keptKey = links[2].Url[(links[2].Url.IndexOf("k=", StringComparison.Ordinal) + 2)..];
        Assert.NotNull(await service.OpenSharedAsync("R-3.pdf", keptKey));
    }

    [Fact]
    public async Task Missing_request_number_falls_back_to_display_id()
    {
        var (db, requestId) = await SeedAsync();
        var service = new ValuationReportPdfService(db, new FakeRenderer(), Signer(), new TestClock(Start));

        var r = await service.CreateFromHtmlAsync(requestId, new CreateValuationReportPdfRequest { Html = Html }, null);

        Assert.Equal("VR-453.pdf", r.Link!.FileName);
        Assert.Equal("VR-453", r.Link.ReportNumber);
    }

    [Fact]
    public async Task Validation_and_renderer_failures_map_to_distinct_outcomes()
    {
        var (db, requestId) = await SeedAsync();
        var signer = Signer();
        var clock = new TestClock(Start);

        var ok = new ValuationReportPdfService(db, new FakeRenderer(), signer, clock);
        var empty = await ok.CreateFromHtmlAsync(requestId, new CreateValuationReportPdfRequest { Html = "  " }, null);
        Assert.Equal(ValuationReportPdfFailure.InvalidHtml, empty.Failure);
        var noTags = await ok.CreateFromHtmlAsync(requestId, new CreateValuationReportPdfRequest { Html = new string('x', 200) }, null);
        Assert.Equal(ValuationReportPdfFailure.InvalidHtml, noTags.Failure);
        var unknown = await ok.CreateFromHtmlAsync(Guid.NewGuid(), new CreateValuationReportPdfRequest { Html = Html }, null);
        Assert.Equal(ValuationReportPdfFailure.RequestNotFound, unknown.Failure);

        var notConfigured = new ValuationReportPdfService(db, new FakeRenderer { Configured = false }, signer, clock);
        var r1 = await notConfigured.CreateFromHtmlAsync(requestId, new CreateValuationReportPdfRequest { Html = Html }, null);
        Assert.Equal(ValuationReportPdfFailure.RendererUnavailable, r1.Failure);

        var down = new ValuationReportPdfService(db, new FakeRenderer { Throw = new HtmlPdfRendererUnavailableException("down") }, signer, clock);
        var r2 = await down.CreateFromHtmlAsync(requestId, new CreateValuationReportPdfRequest { Html = Html }, null);
        Assert.Equal(ValuationReportPdfFailure.RendererUnavailable, r2.Failure);

        var broken = new ValuationReportPdfService(db, new FakeRenderer { Throw = new HtmlPdfRenderFailedException("bad") }, signer, clock);
        var r3 = await broken.CreateFromHtmlAsync(requestId, new CreateValuationReportPdfRequest { Html = Html }, null);
        Assert.Equal(ValuationReportPdfFailure.RendererFailed, r3.Failure);

        Assert.Empty(await db.ValuationReportPdfs.ToListAsync());
        Assert.All(new[] { empty, noTags, unknown, r1, r2, r3 }, r => Assert.False(string.IsNullOrWhiteSpace(r.MessageAr)));
    }

    [Fact]
    public void Signer_reuses_the_jwt_key_and_honors_the_previous_key()
    {
        var current = Signer("current-key-0123456789-0123456789-0123456789", previous: "old-key-0123456789-0123456789-0123456789");
        var old = Signer("old-key-0123456789-0123456789-0123456789");
        var id = Guid.NewGuid();
        var exp = Start.AddDays(1);

        var oldToken = old.Sign(id, "a.pdf", exp);
        Assert.NotNull(current.Verify(oldToken, "a.pdf", Start));
        Assert.NotNull(current.Verify(current.Sign(id, "a.pdf", exp), "a.pdf", Start));
        Assert.Null(old.Verify(current.Sign(id, "a.pdf", exp), "a.pdf", Start));
        Assert.Equal(TimeSpan.FromDays(90), current.Lifetime);
    }

    [Fact]
    public void Signer_without_any_secret_fails_fast()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection([]).Build();
        Assert.Throws<InvalidOperationException>(() =>
            new ReportLinkSigner(config, Options.Create(new ReportPdfLinkOptions())));
    }

    private static ReportLinkSigner Signer(
        string key = "jwt-signing-key-for-tests-0123456789-0123456789-0123456789",
        string? previous = null)
    {
        var values = new Dictionary<string, string?> { ["Jwt:SigningKey"] = key };
        if (previous is not null) values["Jwt:PreviousSigningKey"] = previous;
        var config = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        return new ReportLinkSigner(config, Options.Create(new ReportPdfLinkOptions()));
    }

    private static async Task<(ValuationDbContext Db, Guid RequestId)> SeedAsync()
    {
        var db = new ValuationDbContext(new DbContextOptionsBuilder<ValuationDbContext>()
            .UseInMemoryDatabase($"report-pdfs-{Guid.NewGuid():N}")
            .Options);
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id,
            "VR-453",
            Guid.NewGuid(),
            "الرياض",
            "فيلا",
            "عبدالله",
            "2026-09-01",
            Start.UtcDateTime));
        await db.SaveChangesAsync();
        return (db, id);
    }

    private sealed class TestClock(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan by) => _now = _now.Add(by);
    }

    private sealed class FakeRenderer : IHtmlPdfRenderer
    {
        public static readonly byte[] Pdf = Encoding.ASCII.GetBytes("%PDF-1.7\n%fake\n%%EOF\n");

        public bool Configured { get; init; } = true;
        public Exception? Throw { get; init; }
        public string? LastHtml { get; private set; }

        public string Name => "fake-renderer";
        public bool IsConfigured => Configured;

        public Task<byte[]> RenderAsync(string html, CancellationToken cancellationToken = default)
        {
            if (Throw is not null) throw Throw;
            LastHtml = html;
            return Task.FromResult(Pdf);
        }
    }
}
