using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Valuation.Application.Rules;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The pure half of the contract for the array endpoints added in
/// docs/architecture/pagination-contract.md §§4-7: comparables, failures, notifications and the two
/// financial ledgers. Same shared rules as the first three endpoints — an unknown sort key falls
/// back to the default and never answers 400, and <c>dir</c> defaults to <c>desc</c>.
/// </summary>
public class ComparablePropertyListQueryRulesTests
{
    [Theory]
    [InlineData("transaction", ComparablePropertyListSortKey.TransactionDate)]
    [InlineData("created", ComparablePropertyListSortKey.Created)]
    [InlineData("price", ComparablePropertyListSortKey.Price)]
    [InlineData("pricePerSqm", ComparablePropertyListSortKey.PricePerSqm)]
    [InlineData("  AREA ", ComparablePropertyListSortKey.Area)]
    [InlineData("district", ComparablePropertyListSortKey.District)]
    public void Allowed_sort_keys_map_to_columns(string sort, ComparablePropertyListSortKey expected)
    {
        Assert.Equal(expected, ComparablePropertyListQueryRules.ResolveSort(sort));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("latitude")]
    public void Unknown_sort_falls_back_to_the_default(string? sort)
    {
        Assert.Equal(
            ComparablePropertyListSortKey.TransactionDate,
            ComparablePropertyListQueryRules.ResolveSort(sort));
    }

    [Fact]
    public void Every_allowed_sort_key_resolves_to_a_distinct_column()
    {
        var mapped = ComparablePropertyListQueryRules.AllowedSortKeys
            .Select(ComparablePropertyListQueryRules.ResolveSort)
            .ToList();

        Assert.Equal(
            ComparablePropertyListQueryRules.AllowedSortKeys.Count,
            mapped.Distinct().Count());
    }

    [Theory]
    [InlineData("asc", false)]
    [InlineData("desc", true)]
    [InlineData("sideways", true)]
    [InlineData(null, true)]
    public void Direction_defaults_to_descending(string? dir, bool expected)
    {
        Assert.Equal(expected, ComparablePropertyListQueryRules.ResolveDescending(dir));
    }

    /// <summary>A blank or unparsable subject id means "no priority", never an error.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-guid")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public void An_unusable_subject_property_means_no_priority(string? value)
    {
        Assert.Null(ComparablePropertyListQueryRules.ResolveForPropertyId(value));
    }

    [Fact]
    public void A_real_subject_property_is_parsed()
    {
        var id = Guid.NewGuid();
        Assert.Equal(id, ComparablePropertyListQueryRules.ResolveForPropertyId(id.ToString()));
    }
}

public class FailureListQueryRulesTests
{
    [Theory]
    [InlineData("updated", FailureListSortKey.Updated)]
    [InlineData("created", FailureListSortKey.Created)]
    [InlineData("po", FailureListSortKey.PoNumber)]
    [InlineData(" DEED ", FailureListSortKey.Deed)]
    public void Allowed_sort_keys_map_to_columns(string sort, FailureListSortKey expected)
    {
        Assert.Equal(expected, FailureListQueryRules.ResolveSort(sort));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("severity")]
    public void Unknown_sort_falls_back_to_the_default(string? sort)
    {
        Assert.Equal(FailureListSortKey.Updated, FailureListQueryRules.ResolveSort(sort));
    }

    [Fact]
    public void Statuses_are_a_csv_of_the_persisted_values()
    {
        Assert.Equal(
            [PropertyFailureStatus.Internal, PropertyFailureStatus.Review],
            FailureListQueryRules.ResolveStatuses("internal, REVIEW"));
    }

    /// <summary>Same drop-unknown rule as the workflow-task queue: a typo never empties the list.</summary>
    [Fact]
    public void Unknown_status_tokens_are_dropped()
    {
        Assert.Equal(
            [PropertyFailureStatus.Suspended],
            FailureListQueryRules.ResolveStatuses("suspended,exploded"));
        Assert.Empty(FailureListQueryRules.ResolveStatuses("exploded"));
        Assert.Empty(FailureListQueryRules.ResolveStatuses(null));
    }

    [Fact]
    public void Repeated_status_tokens_collapse()
    {
        Assert.Equal(
            [PropertyFailureStatus.Review],
            FailureListQueryRules.ResolveStatuses("review,review"));
    }

    [Fact]
    public void Blank_exact_filters_and_search_mean_no_filter()
    {
        Assert.Null(FailureListQueryRules.NormalizeExact("   "));
        Assert.Null(FailureListQueryRules.NormalizeSearch(""));
        Assert.Equal("PO-1", FailureListQueryRules.NormalizeExact("  PO-1 "));
    }
}

public class NotificationListQueryRulesTests
{
    /// <summary>The feed has one meaningful order; every key resolves to it.</summary>
    [Theory]
    [InlineData("created")]
    [InlineData("whatever")]
    [InlineData(null)]
    public void Every_sort_value_resolves_to_creation_time(string? sort)
    {
        Assert.Equal(NotificationListSortKey.Created, NotificationListQueryRules.ResolveSort(sort));
    }

    [Theory]
    [InlineData("asc", false)]
    [InlineData("desc", true)]
    [InlineData("newest", true)]
    public void Direction_defaults_to_descending(string dir, bool expected)
    {
        Assert.Equal(expected, NotificationListQueryRules.ResolveDescending(dir));
    }

    [Fact]
    public void Unread_is_a_tri_state()
    {
        Assert.True(NotificationListQueryRules.ResolveUnread(true));
        Assert.False(NotificationListQueryRules.ResolveUnread(false));
        Assert.Null(NotificationListQueryRules.ResolveUnread(null));
    }
}

public class FinancialLedgerListQueryRulesTests
{
    [Theory]
    [InlineData("created", FinancialLedgerListSortKey.Created)]
    [InlineData(" TRANSACTION ", FinancialLedgerListSortKey.TransactionKey)]
    [InlineData("amount", FinancialLedgerListSortKey.Created)]
    [InlineData(null, FinancialLedgerListSortKey.Created)]
    public void Sort_keys_map_or_fall_back(string? sort, FinancialLedgerListSortKey expected)
    {
        Assert.Equal(expected, FinancialLedgerListQueryRules.ResolveSort(sort));
    }

    [Fact]
    public void Every_allowed_sort_key_resolves_to_a_distinct_column()
    {
        var mapped = FinancialLedgerListQueryRules.AllowedSortKeys
            .Select(FinancialLedgerListQueryRules.ResolveSort)
            .ToList();

        Assert.Equal(
            FinancialLedgerListQueryRules.AllowedSortKeys.Count,
            mapped.Distinct().Count());
    }

    [Theory]
    [InlineData("asc", false)]
    [InlineData("desc", true)]
    [InlineData("", true)]
    public void Direction_defaults_to_descending(string dir, bool expected)
    {
        Assert.Equal(expected, FinancialLedgerListQueryRules.ResolveDescending(dir));
    }

    [Fact]
    public void Blank_exact_filters_and_search_mean_no_filter()
    {
        Assert.Null(FinancialLedgerListQueryRules.NormalizeExact(" "));
        Assert.Null(FinancialLedgerListQueryRules.NormalizeSearch("\t"));
        Assert.Equal("PO-9", FinancialLedgerListQueryRules.NormalizeExact(" PO-9 "));
    }
}
