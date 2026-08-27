using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

public class WorkOrderProperty
{
    public Guid Id { get; set; }
    public Guid WorkOrderId { get; set; }
    public PropertyIdentifierType IdentifierType { get; set; }
 /// <summary>Deed kind — traditional / registered title.</summary>
    public DeedKind DeedKind { get; set; } = DeedKind.Traditional;
    public string DeedNumber { get; set; } = "";
 /// <summary>Request number (formerly task number).</summary>
    public string? RequestNumber { get; set; }
 /// <summary>false = no request number; field may be skipped.</summary>
    public bool HasRequestNumber { get; set; } = true;
 /// <summary>Assignment mandate number — required initial data.</summary>
    public string? AssignmentMandateNumber { get; set; }
 /// <summary>Assignment mandate date — required initial data (yyyy-MM-dd).</summary>
    public string? AssignmentMandateDate { get; set; }
    public string? DeedDate { get; set; }
 /// <summary>Real-estate registration number — registered-title path.</summary>
    public string? RealEstateRegNumber { get; set; }
 /// <summary>Real-estate registration date — registered-title path (yyyy-MM-dd).</summary>
    public string? RealEstateRegDate { get; set; }
    public string? OwnerName { get; set; }
 /// <summary>JSON array of {name, sharePct} — الملاك وحصصهم from the deed transcription.</summary>
    public string? DeedOwnersJson { get; set; }
 /// <summary>Manual نوع الملكية override — see <see cref="OwnershipTypes"/>. Null = derived.</summary>
    public string? OwnershipType { get; set; }
 /// <summary>True when the valuer overrode the derived ownership type (e.g. استثمار).</summary>
    public bool OwnershipTypeIsManual { get; set; }
 /// <summary>yes / no — property restrictions (bourse stage).</summary>
    public string? RestrictionsPresent { get; set; }
 /// <summary>mortgaged / seized / suspended / other — comma-separated when multiple.</summary>
    public string? RestrictionType { get; set; }
 /// <summary>Restriction reason when type includes other.</summary>
    public string? RestrictionOtherReason { get; set; }
 /// <summary>deed / bourse / doc / no</summary>
    public string? BoundariesAvailability { get; set; }
    public string? BoundariesExternalDocName { get; set; }
    public string? NorthBoundary { get; set; }
    public string? NorthBoundaryLengthM { get; set; }
 /// <summary>street | plot | passage | rail.</summary>
    public string? NorthBoundaryType { get; set; }
 /// <summary>Facade finishing material — north.</summary>
    public string? NorthFacadeFinishing { get; set; }
    public string? SouthBoundary { get; set; }
    public string? SouthBoundaryLengthM { get; set; }
    public string? SouthBoundaryType { get; set; }
    public string? SouthFacadeFinishing { get; set; }
    public string? EastBoundary { get; set; }
    public string? EastBoundaryLengthM { get; set; }
    public string? EastBoundaryType { get; set; }
    public string? EastFacadeFinishing { get; set; }
    public string? WestBoundary { get; set; }
    public string? WestBoundaryLengthM { get; set; }
    public string? WestBoundaryType { get; set; }
    public string? WestFacadeFinishing { get; set; }
    public string City { get; set; } = "";
 /// <summary>Region name (snapshot from region catalog).</summary>
    public string? Region { get; set; }
    public string District { get; set; } = "";
    public string? DeedStatus { get; set; }
    public string? Area { get; set; }
    public string? Court { get; set; }
    public string? Circuit { get; set; }
 /// <summary>Court catalog ref (optional; name copied into Court).</summary>
    public Guid? CourtId { get; set; }
 /// <summary>Circuit catalog ref (optional; number copied into Circuit).</summary>
    public Guid? CircuitId { get; set; }
 /// <summary>Region catalog ref.</summary>
    public Guid? RegionId { get; set; }
 /// <summary>City catalog ref.</summary>
    public Guid? CityId { get; set; }
    public string Classification { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public string? AssignmentDocFileName { get; set; }
    public string? DelegationLetterFileName { get; set; }
 /// <summary>JSON array of filenames.</summary>
    public string? OtherDocumentFileNames { get; set; }
    public string? RealEstateRegFileName { get; set; }
 /// <summary>Ownership deed image — initial-data attachment.</summary>
    public string? DeedOwnershipFileName { get; set; }
 /// <summary>Deed image from bourse — bourse-inquiry attachment.</summary>
    public string? BourseDeedImageFileName { get; set; }
    public bool BourseDataCompleted { get; set; }
    public DateTime? BourseCompletedAtUtc { get; set; }
 /// <summary>Plan number — initial data.</summary>
    public string? PlanNumber { get; set; }
 /// <summary>Plan name — seed field property_plan_name.</summary>
    public string? PlanName { get; set; }
 /// <summary>Plot number — initial data.</summary>
    public string? PlotNumber { get; set; }
 /// <summary>Block number — seed field property_block_number.</summary>
    public string? BlockNumber { get; set; }
 /// <summary>Site map URL — initial data (ad-hoc when no plan/plot).</summary>
    public string? LocationMapUrl { get; set; }

    /// <summary>محضر التجزئة — رقم.</summary>
    public string? PartitionMinutesNumber { get; set; }
    /// <summary>محضر التجزئة — تاريخ.</summary>
    public string? PartitionMinutesDate { get; set; }

    /// <summary>Finishing level: luxury | medium | ordinary | none.</summary>
    public string? FinishingType { get; set; }
 /// <summary>Structural system: concrete | metal | mixed | other.</summary>
    public string? FinishingStructure { get; set; }

 /// <summary>Are there buildings/structures to value? yes | no | ""</summary>
    public string HasStructuresToValue { get; set; } = "";

 // حدود المعاينة (القرار 24 + ق-7) — نمط سؤال الإنشاءات: أعمدة على العقار.
 /// <summary>نطاق المعاينة: full | external | desktop | "" (لم يُلتقط).</summary>
    public string InspectionScopeKey { get; set; } = "";
 /// <summary>سبب تقييد/تعذّر المعاينة — إلزامي عند نطاق غير كامل.</summary>
    public string? InspectionRestrictionReason { get; set; }
 /// <summary>JSON — وحدات لم تُعايَن (عدد + سبب لكل حالة).</summary>
    public string? UninspectedUnitsJson { get; set; }
 /// <summary>ق-7 — اعتماد المقيّم المعتمد لنطاق «مكتبية عن بُعد».</summary>
    public string? RemoteInspectionApprovedBy { get; set; }
    public DateTime? RemoteInspectionApprovedAtUtc { get; set; }

 /// <summary>Soft-removed from transaction queues; still listed on the work-order property list.</summary>
    public bool IsRemoved { get; set; }

 /// <summary>Removal reason — shown on the property list.</summary>
    public string? RemovalReason { get; set; }

    public DateTime? RemovedAtUtc { get; set; }

    public WorkOrder? WorkOrder { get; set; }
    public ICollection<PropertyContact> Contacts { get; set; } = [];
    public ICollection<BuildingInventoryLine> BuildingInventoryLines { get; set; } = [];
}
