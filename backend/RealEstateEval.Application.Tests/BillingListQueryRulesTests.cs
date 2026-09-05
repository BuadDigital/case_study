using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The pure half of docs/architecture/pagination-contract.md §9-§10: the party billing statement
/// and ready-line lists and the two Enfaz billing lists. Same shared rules as every other
/// endpoint — an unknown sort key falls back and never answers 400, <c>dir</c> defaults to
/// <c>desc</c> — plus the in-memory search / sort / page the synthesised lists apply.
/// </summary>
public class PartyBillingStatementListQueryRulesTests
{
    [Theory]
    [InlineData("created", PartyBillingStatementListSortKey.Created)]
    [InlineData("issued", PartyBillingStatementListSortKey.Issued)]
    [InlineData("closed", PartyBillingStatementListSortKey.Closed)]
    [InlineData(" REFERENCE ", PartyBillingStatementListSortKey.Reference)]
    [InlineData("total", PartyBillingStatementListSortKey.TotalNet)]
    public void Allowed_sort_keys_map_to_columns(string sort, PartyBillingStatementListSortKey expected)
    {
        Assert.Equal(expected, PartyBillingStatementListQueryRules.ResolveSort(sort));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("payee")]
    public void Unknown_sort_falls_back_to_created(string? sort)
    {
        Assert.Equal(
            PartyBillingStatementListSortKey.Created,
            PartyBillingStatementListQueryRules.ResolveSort(sort));
    }

    [Fact]
    public void Every_allowed_sort_key_resolves_to_a_distinct_column()
    {
        var mapped = PartyBillingStatementListQueryRules.AllowedSortKeys
            .Select(PartyBillingStatementListQueryRules.ResolveSort)
            .ToList();

        Assert.Equal(
            PartyBillingStatementListQueryRules.AllowedSortKeys.Count,
            mapped.Distinct().Count());
    }

    [Theory]
    [InlineData("asc", false)]
    [InlineData("desc", true)]
    [InlineData("sideways", true)]
    [InlineData(null, true)]
    public void Direction_defaults_to_descending(string? dir, bool expected)
    {
        Assert.Equal(expected, PartyBillingStatementListQueryRules.ResolveDescending(dir));
    }

    [Fact]
    public void Blank_status_is_no_filter()
    {
        Assert.Null(PartyBillingStatementListQueryRules.ResolveStatuses(null));
        Assert.Null(PartyBillingStatementListQueryRules.ResolveStatuses("   "));
    }

    [Fact]
    public void Status_csv_keeps_known_tokens_and_drops_unknown_ones()
    {
        var statuses = PartyBillingStatementListQueryRules.ResolveStatuses(
            " draft, Issued ,archived,invoice_received,draft");

        Assert.Equal(
            [
                PartyBillingStatementStatus.Draft,
                PartyBillingStatementStatus.Issued,
                PartyBillingStatementStatus.InvoiceReceived,
            ],
            statuses);
    }

    /// <summary>
    /// The endpoint always answered an unknown status with an empty list; the CSV form keeps that
    /// so a typo never widens a payee's view. An empty (non-null) list is the "match nothing" signal.
    /// </summary>
    [Fact]
    public void All_unknown_statuses_match_no_row()
    {
        var statuses = PartyBillingStatementListQueryRules.ResolveStatuses("archived,void");

        Assert.NotNull(statuses);
        Assert.Empty(statuses);
    }

    [Fact]
    public void Filter_is_built_from_normalised_values()
    {
        var filter = PartyBillingStatementListQueryRules.ToFilter(new PartyBillingStatementListQuery
        {
            AssigneeId = " office-1 ",
            Status = "closed",
            IssuedOrLaterOnly = true,
            Q = "  DS-2026-7 ",
        });

        Assert.Equal("office-1", filter.AssigneeId);
        Assert.Equal([PartyBillingStatementStatus.Closed], filter.Statuses);
        Assert.True(filter.IssuedOrLaterOnly);
        Assert.Equal("DS-2026-7", filter.Search);

        var empty = PartyBillingStatementListQueryRules.ToFilter(PartyBillingStatementListQuery.Empty);
        Assert.Null(empty.AssigneeId);
        Assert.Null(empty.Statuses);
        Assert.False(empty.IssuedOrLaterOnly);
        Assert.Null(empty.Search);
    }

    [Fact]
    public void Paged_is_page_or_page_size()
    {
        Assert.False(PartyBillingStatementListQuery.Empty.IsPaged);
        Assert.True(new PartyBillingStatementListQuery { Page = 2 }.IsPaged);
        Assert.True(new PartyBillingStatementListQuery { PageSize = 10 }.IsPaged);
    }
}

public class PartyBillingReadyLineListQueryRulesTests
{
    private static readonly DateTime T0 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static PartyBillingReadyLineDto Line(
        string task,
        string po,
        string label,
        decimal net,
        int accruedDay,
        int? updatedDay = null) => new()
        {
            WorkflowTaskId = task,
            PoNumber = po,
            PropertyLabel = label,
            NetFeeSar = net,
            AccruedAtUtc = T0.AddDays(accruedDay),
            UpdatedAtUtc = updatedDay is null ? null : T0.AddDays(updatedDay.Value),
        };

    private static readonly List<PartyBillingReadyLineDto> Lines =
    [
        Line("t-1", "PO-10", "310107029844 — النرجس", 400m, accruedDay: 5, updatedDay: 9),
        Line("t-2", "PO-11", "310107011111 — الياسمين", 250m, accruedDay: 1, updatedDay: 7),
        Line("t-3", "PO-10", "310107022222 — الملقا", 300m, accruedDay: 3),
    ];

    [Theory]
    [InlineData("updated", PartyBillingReadyLineListSortKey.Updated)]
    [InlineData("accrued", PartyBillingReadyLineListSortKey.Accrued)]
    [InlineData("net", PartyBillingReadyLineListSortKey.NetFee)]
    [InlineData(" PO ", PartyBillingReadyLineListSortKey.PoNumber)]
    [InlineData("nonsense", PartyBillingReadyLineListSortKey.Updated)]
    [InlineData(null, PartyBillingReadyLineListSortKey.Updated)]
    public void Sort_keys_resolve_and_unknown_falls_back(string? sort, PartyBillingReadyLineListSortKey expected)
    {
        Assert.Equal(expected, PartyBillingReadyLineListQueryRules.ResolveSort(sort));
    }

    [Fact]
    public void Every_allowed_sort_key_resolves_to_a_distinct_column()
    {
        var mapped = PartyBillingReadyLineListQueryRules.AllowedSortKeys
            .Select(PartyBillingReadyLineListQueryRules.ResolveSort)
            .ToList();

        Assert.Equal(PartyBillingReadyLineListQueryRules.AllowedSortKeys.Count, mapped.Distinct().Count());
    }

    [Fact]
    public void Default_order_is_last_update_newest_first()
    {
        var ordered = PartyBillingReadyLineListQueryRules.Apply(Lines, PartyBillingReadyLineListQuery.Empty);

        // t-3 has no UpdatedAtUtc and falls back to its accrual (day 3).
        Assert.Equal(["t-1", "t-2", "t-3"], ordered.Select(l => l.WorkflowTaskId));
    }

    [Fact]
    public void Accrued_ascending_is_the_dues_screen_order()
    {
        var ordered = PartyBillingReadyLineListQueryRules.Apply(
            Lines,
            new PartyBillingReadyLineListQuery { Sort = "accrued", Dir = "asc" });

        Assert.Equal(["t-2", "t-3", "t-1"], ordered.Select(l => l.WorkflowTaskId));
    }

    [Fact]
    public void Search_covers_label_po_and_task_id_case_insensitively()
    {
        // Both PO-10 lines tie on the PO sort; the label tiebreaker (ordinal) puts …22222 first.
        Assert.Equal(
            ["t-3", "t-1"],
            PartyBillingReadyLineListQueryRules.Apply(
                    Lines, new PartyBillingReadyLineListQuery { Q = " po-10 ", Sort = "po", Dir = "asc" })
                .Select(l => l.WorkflowTaskId));
        Assert.Equal(
            ["t-2"],
            PartyBillingReadyLineListQueryRules.Apply(Lines, new PartyBillingReadyLineListQuery { Q = "الياسمين" })
                .Select(l => l.WorkflowTaskId));
        Assert.Equal(
            ["t-3"],
            PartyBillingReadyLineListQueryRules.Apply(Lines, new PartyBillingReadyLineListQuery { Q = "T-3" })
                .Select(l => l.WorkflowTaskId));
        Assert.Equal(3, PartyBillingReadyLineListQueryRules.Apply(Lines, new PartyBillingReadyLineListQuery { Q = "  " }).Count);
    }

    [Fact]
    public void Net_sort_is_stable_on_label_then_task_id()
    {
        var tie = new List<PartyBillingReadyLineDto>
        {
            Line("t-b", "PO-1", "b", 100m, accruedDay: 1),
            Line("t-a", "PO-1", "a", 100m, accruedDay: 1),
            Line("t-c", "PO-1", "a", 100m, accruedDay: 1),
        };

        var ordered = PartyBillingReadyLineListQueryRules.Apply(tie, new PartyBillingReadyLineListQuery { Sort = "net" });

        Assert.Equal(["t-a", "t-c", "t-b"], ordered.Select(l => l.WorkflowTaskId));
    }
}

public class EnfazBillingReadyPoListQueryRulesTests
{
    private static readonly List<EnfazReadyPoSummaryDto> Scanned =
    [
        new() { PoNumber = "PO-300", DoneCount = 2 },
        new() { PoNumber = "PO-100", DoneCount = 1 },
        new() { PoNumber = "PO-200", DoneCount = 3, CancelledCount = 1 },
    ];

    [Theory]
    [InlineData("created", EnfazReadyPoListSortKey.Created)]
    [InlineData("po", EnfazReadyPoListSortKey.PoNumber)]
    [InlineData("deed", EnfazReadyPoListSortKey.Created)]
    [InlineData(null, EnfazReadyPoListSortKey.Created)]
    public void Sort_keys_resolve_and_unknown_falls_back(string? sort, EnfazReadyPoListSortKey expected)
    {
        Assert.Equal(expected, EnfazReadyPoListQueryRules.ResolveSort(sort));
    }

    [Fact]
    public void Default_keeps_the_scan_order_and_asc_reverses_it()
    {
        Assert.Equal(
            ["PO-300", "PO-100", "PO-200"],
            EnfazReadyPoListQueryRules.Apply(Scanned, EnfazReadyPoListQuery.Empty).Select(r => r.PoNumber));
        Assert.Equal(
            ["PO-200", "PO-100", "PO-300"],
            EnfazReadyPoListQueryRules.Apply(Scanned, new EnfazReadyPoListQuery { Dir = "asc" })
                .Select(r => r.PoNumber));
    }

    [Fact]
    public void Po_sort_and_search_apply_over_the_scan()
    {
        Assert.Equal(
            ["PO-100", "PO-200", "PO-300"],
            EnfazReadyPoListQueryRules.Apply(Scanned, new EnfazReadyPoListQuery { Sort = "po", Dir = "asc" })
                .Select(r => r.PoNumber));
        Assert.Equal(
            ["PO-200"],
            EnfazReadyPoListQueryRules.Apply(Scanned, new EnfazReadyPoListQuery { Q = "po-2" })
                .Select(r => r.PoNumber));
    }
}

public class EnfazBillingTrackingListQueryRulesTests
{
    private static readonly DateTime T0 = new(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);

    private static EnfazTrackingRowDto Row(
        string po,
        string property,
        string deed,
        string city,
        int? completedDay = null,
        string? invoice = null,
        int? issuedDay = null) => new()
        {
            PoNumber = po,
            PropertyId = property,
            PropertyLabel = $"{deed} — {city}",
            DeedNumber = deed,
            City = city,
            CompletedAtUtc = completedDay is null ? null : T0.AddDays(completedDay.Value),
            InvoiceNumber = invoice,
            InvoiceIssuedAtUtc = issuedDay is null ? null : T0.AddDays(issuedDay.Value),
        };

    private static readonly List<EnfazTrackingRowDto> Scanned =
    [
        Row("PO-2", "p-21", "5001", "الرياض", completedDay: 4, invoice: "INV-9", issuedDay: 6),
        Row("PO-2", "p-22", "5002", "جدة", completedDay: 2),
        Row("PO-1", "p-11", "4001", "الرياض", completedDay: 8, invoice: "INV-3", issuedDay: 1),
    ];

    [Theory]
    [InlineData("created", EnfazTrackingListSortKey.Created)]
    [InlineData("po", EnfazTrackingListSortKey.PoNumber)]
    [InlineData("completed", EnfazTrackingListSortKey.Completed)]
    [InlineData("invoiceIssued", EnfazTrackingListSortKey.InvoiceIssued)]
    [InlineData("INVOICEISSUED", EnfazTrackingListSortKey.InvoiceIssued)]
    [InlineData("city", EnfazTrackingListSortKey.Created)]
    [InlineData(null, EnfazTrackingListSortKey.Created)]
    public void Sort_keys_resolve_and_unknown_falls_back(string? sort, EnfazTrackingListSortKey expected)
    {
        Assert.Equal(expected, EnfazTrackingListQueryRules.ResolveSort(sort));
    }

    [Fact]
    public void Every_allowed_sort_key_resolves_to_a_distinct_column()
    {
        var mapped = EnfazTrackingListQueryRules.AllowedSortKeys
            .Select(EnfazTrackingListQueryRules.ResolveSort)
            .ToList();

        Assert.Equal(EnfazTrackingListQueryRules.AllowedSortKeys.Count, mapped.Distinct().Count());
    }

    [Fact]
    public void Default_keeps_the_scan_order()
    {
        Assert.Equal(
            ["p-21", "p-22", "p-11"],
            EnfazTrackingListQueryRules.Apply(Scanned, EnfazTrackingListQuery.Empty).Select(r => r.PropertyId));
    }

    [Fact]
    public void Explicit_sorts_end_with_po_then_property_tiebreakers()
    {
        Assert.Equal(
            ["p-11", "p-21", "p-22"],
            EnfazTrackingListQueryRules.Apply(Scanned, new EnfazTrackingListQuery { Sort = "po", Dir = "asc" })
                .Select(r => r.PropertyId));
        Assert.Equal(
            ["p-11", "p-21", "p-22"],
            EnfazTrackingListQueryRules.Apply(Scanned, new EnfazTrackingListQuery { Sort = "completed" })
                .Select(r => r.PropertyId));
        // Rows with no invoice sort as MinValue: last with desc.
        Assert.Equal(
            ["p-21", "p-11", "p-22"],
            EnfazTrackingListQueryRules.Apply(Scanned, new EnfazTrackingListQuery { Sort = "invoiceIssued" })
                .Select(r => r.PropertyId));
    }

    [Fact]
    public void Search_covers_po_deed_label_city_and_invoice()
    {
        static IEnumerable<string> Ids(string q) =>
            EnfazTrackingListQueryRules.Apply(Scanned, new EnfazTrackingListQuery { Q = q })
                .Select(r => r.PropertyId);

        Assert.Equal(["p-21", "p-22"], Ids("po-2"));
        Assert.Equal(["p-11"], Ids("4001"));
        Assert.Equal(["p-21", "p-11"], Ids("الرياض"));
        Assert.Equal(["p-11"], Ids("inv-3"));
        Assert.Equal(3, Ids("   ").Count());
    }
}

public class MaterialisedListPageTests
{
    [Fact]
    public void Cuts_the_window_and_counts_the_whole_list()
    {
        var rows = Enumerable.Range(1, 23).ToList();

        var page = MaterialisedListPage.Cut(rows, skip: 10, take: 10, page: 2);

        Assert.Equal(Enumerable.Range(11, 10), page.Items);
        Assert.Equal(23, page.TotalCount);
        Assert.Equal(2, page.Page);
        Assert.Equal(10, page.PageSize);
        Assert.Equal(3, page.TotalPages);
    }

    [Fact]
    public void A_page_past_the_end_is_empty_but_keeps_the_count()
    {
        var page = MaterialisedListPage.Cut(Enumerable.Range(1, 5).ToList(), skip: 50, take: 10, page: 6);

        Assert.Empty(page.Items);
        Assert.Equal(5, page.TotalCount);
        Assert.Equal(1, page.TotalPages);
    }
}
