using System.Text.Json;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A→Z 2026-11-02 #58 / #59: the inspection returned for correction — the inspector confirms the corrected
/// data again, and the timeline tells the resubmission apart.
/// </summary>
public class InspectionCorrectionRoundTests
{
    private static readonly DateTime Now = new(2026, 11, 4, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void A_returned_inspection_clears_the_inspectors_declaration()
    {
        var json = PartyTaskSubmissionPayloadRules.SetPayloadReopened(
            """{"status":"submitted","inspectionConfirmed":true,"notes":"x"}""", "صحّح الحدود", Now);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        Assert.Equal(JsonValueKind.False, root.GetProperty("inspectionConfirmed").ValueKind);
        Assert.Equal(PartyTaskSubmissionStatus.Reopened, root.GetProperty("status").GetString());
        Assert.Equal("صحّح الحدود", root.GetProperty("returnNote").GetString());
        Assert.Equal("x", root.GetProperty("notes").GetString());
    }

    [Fact]
    public void A_returned_package_without_the_declaration_gets_none_added()
    {
        var json = PartyTaskSubmissionPayloadRules.SetPayloadReopened(
            """{"status":"submitted","surveyNotes":"ok"}""", "ملاحظة", Now);
        using var doc = JsonDocument.Parse(json);
        Assert.False(doc.RootElement.TryGetProperty("inspectionConfirmed", out _));
    }

    [Fact]
    public void The_resubmission_after_a_correction_is_labelled_on_the_timeline()
    {
        Assert.Equal(
            "إتمام المعاينة الميدانية",
            WorkflowTaskKindLabels.SubmittedTitleAr(WorkflowTaskKindValues.FieldInspection, afterCorrection: false));
        Assert.Equal(
            "إتمام المعاينة الميدانية بعد التصحيح",
            WorkflowTaskKindLabels.SubmittedTitleAr(WorkflowTaskKindValues.FieldInspection, afterCorrection: true));
    }
}
