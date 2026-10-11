using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class ValuationReportPdfServiceTests
{
    private static readonly DateTimeOffset Start = new(2026, 9, 9, 10, 0, 0, TimeSpan.Zero);
    private static readonly byte[] Pdf = Encoding.ASCII.GetBytes("%PDF-1.7\n%fake\n%%EOF\n");

    [Fact]
    public async Task A_shared_link_opens_its_stored_copy_until_it_expires()
    {
        await using var db = CreateDb();
        var row = ValuationReportPdf.Create(
            Guid.NewGuid(),
            "051421",
            "051421.pdf",
            Pdf,
            Convert.ToHexStringLower(SHA256.HashData(Pdf)),
            "fake-renderer",
            "user-1",
            Start.UtcDateTime);
        db.ValuationReportPdfs.Add(row);
        await db.SaveChangesAsync();

        var signer = Signer();
        var clock = new TestClock(Start);
        var service = new ValuationReportPdfService(db, signer, clock);
        var key = signer.Sign(row.Id, "051421.pdf", Start.Add(signer.Lifetime));

        var opened = await service.OpenSharedAsync("051421.pdf", key);
        Assert.NotNull(opened);
        Assert.Equal(Pdf, opened.Content);
        Assert.Equal(row.Sha256, opened.Sha256);

        // Same key, other file name → nothing.
        Assert.Null(await service.OpenSharedAsync("051422.pdf", key));
        // A key for a copy that is no longer stored → nothing.
        Assert.Null(await service.OpenSharedAsync(
            "051421.pdf",
            signer.Sign(Guid.NewGuid(), "051421.pdf", Start.AddDays(1))));
        // Expired → nothing.
        clock.Advance(TimeSpan.FromDays(91));
        Assert.Null(await service.OpenSharedAsync("051421.pdf", key));
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

    private static ValuationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ValuationDbContext>()
            .UseInMemoryDatabase($"report-pdfs-{Guid.NewGuid():N}")
            .Options);

    private sealed class TestClock(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan by) => _now = _now.Add(by);
    }
}
