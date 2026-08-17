using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class UninspectedUnitEntryDto
{
    public int Count { get; init; }
    public string Reason { get; init; } = "";
}

/// <summary>حدود المعاينة (القرار 24 + ق-7) — مدخلات منظّمة يعبّئها المعاين.</summary>
public class InspectionLimitsDto
{
    public Guid PropertyId { get; init; }
 /// <summary>full | external | desktop | "" (لم يُلتقط بعد).</summary>
    public string InspectionScopeKey { get; init; } = "";
    public string InspectionScopeLabelAr { get; init; } = "";
    public string? InspectionRestrictionReason { get; init; }
    public IReadOnlyList<UninspectedUnitEntryDto> UninspectedUnits { get; init; } = [];
    public int TotalUninspectedUnits { get; init; }
 /// <summary>نص التحفّظ المركّب آلياً — يوضع ضمن الافتراضات الخاصة.</summary>
    public string ReservationTextAr { get; init; } = "";
 /// <summary>ق-7 — اعتماد المقيّم المعتمد لنطاق «مكتبية عن بُعد».</summary>
    public string? RemoteInspectionApprovedBy { get; init; }
    public string? RemoteInspectionApprovedAtUtc { get; init; }
    public bool RemoteInspectionApproved { get; init; }
}

public class SaveInspectionLimitsRequest
{
    [Required, MaxLength(16)]
    public string InspectionScopeKey { get; init; } = "";

    [MaxLength(2000)]
    public string? InspectionRestrictionReason { get; init; }

    public IReadOnlyList<UninspectedUnitEntryDto> UninspectedUnits { get; init; } = [];
}
