namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>
/// KPI counters for the PO list, computed in SQL over the same filtered, visibility-narrowed set
/// the list endpoint pages. Mirrors <c>poListKpi</c> in
/// <c>apps/mfe-case-study/src/views/po-list-view-state.ts</c> plus the two totals the empty-state
/// copy needs. See docs/architecture/pagination-contract.md §1.1.
/// </summary>
public sealed class WorkOrderListCountsDto
{
 /// <summary>Rows matching the filters. Same number as <c>PagedResultDto.TotalCount</c>.</summary>
    public int Total { get; set; }

 /// <summary>
 /// Rows visible to the actor with <c>q</c> / <c>status</c> / <c>type</c> ignored. The screen's
 /// empty state says «لا توجد أوامر عمل.» when this is zero and «لا توجد نتائج مطابقة» otherwise.
 /// </summary>
    public int TotalUnfiltered { get; set; }

 /// <summary>«أوامر نشطة» — rows whose PO list status is not terminal.</summary>
    public int Active { get; set; }

 /// <summary>«متأخرة عن الاستحقاق» — active rows whose due date is before today.</summary>
    public int Overdue { get; set; }

 /// <summary>«تستحق خلال 48 ساعة» — active rows due tomorrow or the day after.</summary>
    public int DueSoon { get; set; }

 /// <summary>«عقارات أُنجزت» — live properties with a finished case study, over all matched rows.</summary>
    public int DoneProperties { get; set; }
}
