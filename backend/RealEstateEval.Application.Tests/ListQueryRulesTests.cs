using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The pure half of the list contract in docs/architecture/pagination-contract.md: the allow-lists
/// and sort maps that decide what a query string means before any EF expression is built.
/// </summary>
public class WorkOrderListQueryRulesTests
{
    [Theory]
    [InlineData("created", WorkOrderListSortKey.Created)]
    [InlineData("po", WorkOrderListSortKey.PoNumber)]
    [InlineData("received", WorkOrderListSortKey.ReceivedFromEnfath)]
    [InlineData("due", WorkOrderListSortKey.DueDate)]
    [InlineData("  DUE  ", WorkOrderListSortKey.DueDate)]
    public void Allowed_sort_keys_map_to_columns(string sort, WorkOrderListSortKey expected)
    {
        Assert.Equal(expected, WorkOrderListQueryRules.ResolveSort(sort));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("specialist")]
    [InlineData("1; drop table")]
    public void Unknown_sort_falls_back_to_the_default(string? sort)
    {
        Assert.Equal(WorkOrderListSortKey.Created, WorkOrderListQueryRules.ResolveSort(sort));
        Assert.Equal(WorkOrderListQueryRules.DefaultSort, WorkOrderListQueryRules.SortCreated);
    }

    [Fact]
    public void Every_allowed_sort_key_resolves_to_a_distinct_column()
    {
        var mapped = WorkOrderListQueryRules.AllowedSortKeys
            .Select(WorkOrderListQueryRules.ResolveSort)
            .ToList();

        Assert.Equal(WorkOrderListQueryRules.AllowedSortKeys.Count, mapped.Distinct().Count());
    }

    [Theory]
    [InlineData("asc", false)]
    [InlineData("ASC", false)]
    [InlineData("desc", true)]
    [InlineData(null, true)]
    [InlineData("sideways", true)]
    public void Direction_defaults_to_descending(string? dir, bool expected)
    {
        Assert.Equal(expected, WorkOrderListQueryRules.ResolveDescending(dir));
    }

    [Theory]
    [InlineData(WorkOrderListStatus.New, WorkOrderListStatusFilter.New)]
    [InlineData(WorkOrderListStatus.UnderStudy, WorkOrderListStatusFilter.UnderStudy)]
    [InlineData(WorkOrderListStatus.Completed, WorkOrderListStatusFilter.Completed)]
    [InlineData(WorkOrderListStatus.Stopped, WorkOrderListStatusFilter.Stopped)]
    [InlineData(WorkOrderListStatus.Cancelled, WorkOrderListStatusFilter.Cancelled)]
    public void Status_buckets_map_one_to_one(string status, WorkOrderListStatusFilter expected)
    {
        Assert.Equal(expected, WorkOrderListQueryRules.ResolveStatus(status));
    }

    /// <summary>
    /// The invoice flag lives in Financial, so the two billing buckets widen to the study bucket
    /// they refine. The client still narrows those two locally.
    /// </summary>
    [Fact]
    public void Billing_buckets_widen_to_their_study_equivalent()
    {
        Assert.Equal(
            WorkOrderListStatusFilter.UnderStudy,
            WorkOrderListQueryRules.ResolveStatus(WorkOrderListStatus.PartiallyBilled));
        Assert.Equal(
            WorkOrderListStatusFilter.Completed,
            WorkOrderListQueryRules.ResolveStatus(WorkOrderListStatus.FullyBilled));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("archived")]
    public void Unknown_status_is_no_filter(string? status)
    {
        Assert.Null(WorkOrderListQueryRules.ResolveStatus(status));
    }

    [Fact]
    public void Assignment_type_filter_takes_the_label_the_list_shows()
    {
        Assert.Equal(
            AssignmentType.Estates,
            WorkOrderListQueryRules.ResolveAssignmentType(AssignmentTypeLabels.Estates));
        Assert.Null(WorkOrderListQueryRules.ResolveAssignmentType("nonsense"));
        Assert.Null(WorkOrderListQueryRules.ResolveAssignmentType("  "));
    }

    [Fact]
    public void Free_text_matches_assignment_type_labels()
    {
        var matches = WorkOrderListQueryRules.AssignmentTypesMatching("تركات");

        Assert.Equal([AssignmentType.Estates], matches);
        Assert.Empty(WorkOrderListQueryRules.AssignmentTypesMatching("   "));
    }

    [Fact]
    public void Search_is_trimmed_and_blank_means_no_search()
    {
        Assert.Equal("PO-1", WorkOrderListQueryRules.NormalizeSearch("  PO-1 "));
        Assert.Null(WorkOrderListQueryRules.NormalizeSearch("   "));
    }
}

public class WorkflowTaskListQueryRulesTests
{
    [Theory]
    [InlineData("created", WorkflowTaskListSortKey.Created)]
    [InlineData("updated", WorkflowTaskListSortKey.Updated)]
    [InlineData("po", WorkflowTaskListSortKey.PoNumber)]
    [InlineData("poReceived", WorkflowTaskListSortKey.PoReceived)]
    [InlineData("poCreated", WorkflowTaskListSortKey.PoCreated)]
    [InlineData("deed", WorkflowTaskListSortKey.Deed)]
    [InlineData("city", WorkflowTaskListSortKey.City)]
    public void Allowed_sort_keys_map_to_columns(string sort, WorkflowTaskListSortKey expected)
    {
        Assert.Equal(expected, WorkflowTaskListQueryRules.ResolveSort(sort));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("district")]
    public void Unknown_sort_falls_back_to_the_default(string? sort)
    {
        Assert.Equal(WorkflowTaskListSortKey.Created, WorkflowTaskListQueryRules.ResolveSort(sort));
    }

    [Fact]
    public void Every_allowed_sort_key_resolves_to_a_distinct_column()
    {
        var mapped = WorkflowTaskListQueryRules.AllowedSortKeys
            .Select(WorkflowTaskListQueryRules.ResolveSort)
            .ToList();

        Assert.Equal(WorkflowTaskListQueryRules.AllowedSortKeys.Count, mapped.Distinct().Count());
    }

    [Theory]
    [InlineData("asc", false)]
    [InlineData("desc", true)]
    [InlineData(null, true)]
    public void Direction_defaults_to_descending(string? dir, bool expected)
    {
        Assert.Equal(expected, WorkflowTaskListQueryRules.ResolveDescending(dir));
    }

    [Fact]
    public void Kind_list_parses_csv_and_drops_unknown_tokens()
    {
        var kinds = WorkflowTaskListQueryRules.ResolveKinds(
            " field-inspection , not-a-kind ,engineering-survey, field-inspection ");

        Assert.Equal(
            [WorkflowTaskKind.FieldInspection, WorkflowTaskKind.EngineeringSurvey],
            kinds);
    }

    [Fact]
    public void Empty_and_all_unknown_lists_mean_no_filter()
    {
        Assert.Empty(WorkflowTaskListQueryRules.ResolveKinds(null));
        Assert.Empty(WorkflowTaskListQueryRules.ResolveStatuses("  "));
        Assert.Empty(WorkflowTaskListQueryRules.ResolvePhases("nope,also-nope"));
    }

    [Fact]
    public void Status_and_phase_lists_parse_the_wire_values()
    {
        Assert.Equal(
            [WorkflowTaskStatus.Open, WorkflowTaskStatus.Blocked],
            WorkflowTaskListQueryRules.ResolveStatuses("open,blocked"));
        Assert.Equal(
            [WorkflowTaskPhase.Bourse, WorkflowTaskPhase.Distribution],
            WorkflowTaskListQueryRules.ResolvePhases("bourse,distribution"));
    }

    /// <summary>The default queue listing (isListedQueueTask without the "show all" toggle).</summary>
    [Fact]
    public void Listed_statuses_are_open_and_blocked()
    {
        Assert.Equal(
            [WorkflowTaskStatus.Open, WorkflowTaskStatus.Blocked],
            WorkflowTaskListQueryRules.ListedStatuses);
    }

    [Fact]
    public void Exact_filters_are_trimmed_and_blank_means_none()
    {
        Assert.Equal("a-1", WorkflowTaskListQueryRules.NormalizeExact(" a-1 "));
        Assert.Null(WorkflowTaskListQueryRules.NormalizeExact(" "));
    }
}

public class OperationsTaskListQueryRulesTests
{
    [Theory]
    [InlineData("queue", OperationsTaskListSortKey.Queue)]
    [InlineData("created", OperationsTaskListSortKey.Created)]
    [InlineData("due", OperationsTaskListSortKey.Due)]
    [InlineData("updated", OperationsTaskListSortKey.Updated)]
    [InlineData("priority", OperationsTaskListSortKey.Priority)]
    public void Allowed_sort_keys_map_to_orders(string sort, OperationsTaskListSortKey expected)
    {
        Assert.Equal(expected, OperationsTaskListQueryRules.ResolveSort(sort));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("assignee")]
    public void Unknown_sort_falls_back_to_the_queue_order(string? sort)
    {
        Assert.Equal(OperationsTaskListSortKey.Queue, OperationsTaskListQueryRules.ResolveSort(sort));
    }

    [Fact]
    public void Every_allowed_sort_key_resolves_to_a_distinct_order()
    {
        var mapped = OperationsTaskListQueryRules.AllowedSortKeys
            .Select(OperationsTaskListQueryRules.ResolveSort)
            .ToList();

        Assert.Equal(OperationsTaskListQueryRules.AllowedSortKeys.Count, mapped.Distinct().Count());
    }

    [Theory]
    [InlineData("asc", false)]
    [InlineData("desc", true)]
    [InlineData(null, true)]
    public void Direction_defaults_to_descending(string? dir, bool expected)
    {
        Assert.Equal(expected, OperationsTaskListQueryRules.ResolveDescending(dir));
    }

    /// <summary>Same banding as the screen's taskStatusRank: active, then paused, then terminal.</summary>
    [Theory]
    [InlineData(OperationsTaskStatus.Created, 0)]
    [InlineData(OperationsTaskStatus.InProgress, 0)]
    [InlineData(OperationsTaskStatus.Paused, 1)]
    [InlineData(OperationsTaskStatus.Completed, 2)]
    [InlineData(OperationsTaskStatus.Cancelled, 2)]
    public void Status_rank_matches_the_screen(OperationsTaskStatus status, int expected)
    {
        Assert.Equal(expected, OperationsTaskListQueryRules.StatusRank(status));
    }

    [Fact]
    public void Active_statuses_are_created_and_in_progress()
    {
        Assert.Equal(
            [OperationsTaskStatus.Created, OperationsTaskStatus.InProgress],
            OperationsTaskListQueryRules.ActiveStatuses);
    }

    [Fact]
    public void Recognised_enum_filters_resolve_and_blank_means_no_filter()
    {
        Assert.Equal((true, OperationsTaskScope.Transaction), OperationsTaskListQueryRules.ResolveScope("transaction"));
        Assert.Equal((true, OperationsTaskType.CourtVisit), OperationsTaskListQueryRules.ResolveType("court_visit"));
        Assert.Equal((true, OperationsTaskStatus.Paused), OperationsTaskListQueryRules.ResolveStatus("paused"));

        Assert.Equal((true, (OperationsTaskScope?)null), OperationsTaskListQueryRules.ResolveScope(null));
        Assert.Equal((true, (OperationsTaskType?)null), OperationsTaskListQueryRules.ResolveType("  "));
        Assert.Equal((true, (OperationsTaskStatus?)null), OperationsTaskListQueryRules.ResolveStatus(""));
    }

    /// <summary>
    /// An unrecognised value is reported as such so the endpoint returns nothing, keeping the
    /// pre-paging behaviour where a bad status never widened the list.
    /// </summary>
    [Fact]
    public void Unrecognised_enum_filters_are_reported_not_ignored()
    {
        Assert.False(OperationsTaskListQueryRules.ResolveStatus("archived").Recognised);
        Assert.False(OperationsTaskListQueryRules.ResolveScope("galaxy").Recognised);
        Assert.False(OperationsTaskListQueryRules.ResolveType("teleport").Recognised);
    }

    [Fact]
    public void Failure_pause_prefix_is_shared_with_the_lifecycle_rule()
    {
        Assert.True(OperationsTaskLifecycleRules.IsFailureObstructionPauseReason(
            OperationsTaskLifecycleRules.FailurePauseReasonPrefix + " — بانتظار حل الأخصائي/المشرف"));
        Assert.False(OperationsTaskLifecycleRules.IsFailureObstructionPauseReason("إجازة"));
    }
}
