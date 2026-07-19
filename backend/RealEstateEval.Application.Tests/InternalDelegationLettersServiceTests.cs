using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class InternalDelegationLettersServiceTests
{
    [Fact]
    public async Task SaveAsync_preserves_issued_letters()
    {
        await using var db = CreateDb();
        var service = new InternalDelegationLettersService(db);
        const string scope = "reviewer@example.com";

        db.InternalDelegationLetterSets.Add(new InternalDelegationLetterSet
        {
            Id = Guid.NewGuid(),
            ScopeKey = scope,
            LettersJson = """
                [
                  {
                    "id": "محكمة التنفيذ بجدة::الأولى",
                    "city": "جدة",
                    "court": "محكمة التنفيذ بجدة",
                    "circuit": "الأولى",
                    "selectedProperties": [
                      {
                        "propertyId": "p1",
                        "workOrder": "032785",
                        "deedNo": "1",
                        "owner": "مالك",
                        "requestNo": "r1"
                      }
                    ],
                    "reference": "DS-LT-260719-001",
                    "issuedProperties": [
                      {
                        "propertyId": "p1",
                        "workOrder": "032785",
                        "deedNo": "1",
                        "owner": "مالك",
                        "requestNo": "r1"
                      }
                    ],
                    "createdAt": "2026-07-19T00:00:00.0000000Z"
                  }
                ]
                """,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var saved = await service.SaveAsync(new SaveInternalDelegationLettersRequest
        {
            ScopeKey = scope,
            Letters =
            [
                new InternalDelegationLetterDto
                {
                    Id = "محكمة التنفيذ بجدة::الأولى",
                    City = "جدة",
                    Court = "محكمة التنفيذ بجدة",
                    Circuit = "الأولى",
                    SelectedProperties =
                    [
                        new DelegationLetterPropertyDto
                        {
                            PropertyId = "p2",
                            WorkOrder = "999",
                            DeedNo = "2",
                            Owner = "آخر",
                            RequestNo = "r2",
                        },
                    ],
                    CreatedAt = DateTime.UtcNow.ToString("O"),
                },
            ],
        });

        var letter = Assert.Single(saved);
        Assert.Equal("DS-LT-260719-001", letter.Reference);
        Assert.Equal("p1", Assert.Single(letter.IssuedProperties!).PropertyId);
        Assert.Equal("p1", Assert.Single(letter.SelectedProperties).PropertyId);
    }

    [Fact]
    public async Task IssueAsync_assigns_reference_snapshot_and_is_idempotent()
    {
        await using var db = CreateDb();
        var service = new InternalDelegationLettersService(db);
        const string scope = "reviewer@example.com";
        const string letterId = "محكمة التنفيذ بجدة::التاسعة عشر";

        var props = new List<DelegationLetterPropertyDto>
        {
            new()
            {
                PropertyId = "prop-1",
                WorkOrder = "032785",
                DeedNo = "820120009534",
                Owner = "شركة نبر للتنمية العقارية",
                RequestNo = "403094700074181",
            },
        };

        var (issued, error) = await service.IssueAsync(new IssueInternalDelegationLetterRequest
        {
            ScopeKey = scope,
            LetterId = letterId,
            City = "جدة",
            Court = "محكمة التنفيذ بجدة",
            Circuit = "التاسعة عشر",
            SelectedProperties = props,
            Agent = new DelegationLetterAgentDto
            {
                Name = "فراس",
                Nationality = "سعودي",
                NationalId = "1090261940",
                Mobile = "0564473374",
            },
        });

        Assert.Null(error);
        Assert.NotNull(issued);
        Assert.StartsWith("DS-LT-", issued!.Reference);
        Assert.False(string.IsNullOrWhiteSpace(issued.DateHijri));
        Assert.False(string.IsNullOrWhiteSpace(issued.DateGreg));
        Assert.Equal("فراس", issued.Agent?.Name);
        Assert.Equal("prop-1", Assert.Single(issued.IssuedProperties!).PropertyId);
        Assert.Equal(1, await db.DocumentReferenceCounters.CountAsync());
        Assert.Equal(1, (await db.DocumentReferenceCounters.SingleAsync()).Seq);

        var firstRef = issued.Reference;
        var (again, againError) = await service.IssueAsync(new IssueInternalDelegationLetterRequest
        {
            ScopeKey = scope,
            LetterId = letterId,
            SelectedProperties = props,
            Agent = new DelegationLetterAgentDto { Name = "آخر" },
        });

        Assert.Null(againError);
        Assert.Equal(firstRef, again!.Reference);
        Assert.Equal("فراس", again.Agent?.Name);
        Assert.Equal(1, (await db.DocumentReferenceCounters.SingleAsync()).Seq);
    }

    [Fact]
    public async Task IssueAsync_increments_reference_sequence_for_new_letters()
    {
        await using var db = CreateDb();
        var service = new InternalDelegationLettersService(db);
        const string scope = "reviewer@example.com";

        var (first, _) = await service.IssueAsync(MakeIssue(scope, "محكمة أ::د1", "p1"));
        var (second, _) = await service.IssueAsync(MakeIssue(scope, "محكمة أ::د2", "p2"));

        Assert.NotNull(first?.Reference);
        Assert.NotNull(second?.Reference);
        Assert.NotEqual(first!.Reference, second!.Reference);
        Assert.EndsWith("-001", first.Reference!);
        Assert.EndsWith("-002", second.Reference!);
    }

    [Fact]
    public async Task IssueAsync_returns_structured_error_at_daily_limit()
    {
        await using var db = CreateDb();
        var service = new InternalDelegationLettersService(db);
        const string scope = "reviewer@example.com";

        var riyadh = TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows() ? "Arab Standard Time" : "Asia/Riyadh");
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, riyadh);
        var dateKey = local.ToString("yyMMdd", System.Globalization.CultureInfo.InvariantCulture);

        db.DocumentReferenceCounters.Add(new DocumentReferenceCounter
        {
            Id = Guid.NewGuid(),
            Dept = "DS",
            Type = "LT",
            DateKey = dateKey,
            Seq = 999,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var (letter, error) = await service.IssueAsync(MakeIssue(scope, "محكمة أ::د3", "p3"));

        Assert.Null(letter);
        Assert.Equal("تجاوز عدّاد المراجع اليومي الحد الأقصى (999).", error);
    }

    private static IssueInternalDelegationLetterRequest MakeIssue(
        string scope,
        string letterId,
        string propertyId) =>
        new()
        {
            ScopeKey = scope,
            LetterId = letterId,
            City = "جدة",
            Court = letterId.Split("::")[0],
            Circuit = letterId.Split("::")[1],
            SelectedProperties =
            [
                new DelegationLetterPropertyDto
                {
                    PropertyId = propertyId,
                    WorkOrder = "032785",
                    DeedNo = "1",
                    Owner = "مالك",
                    RequestNo = "r1",
                },
            ],
            Agent = new DelegationLetterAgentDto
            {
                Name = "مراجع",
                Nationality = "سعودي",
                NationalId = "1",
                Mobile = "0500000000",
            },
        };

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"delegation-letters-{Guid.NewGuid():N}")
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new ApplicationDbContext(options);
    }
}
