using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class WorkOrderValidatorTests
{
    [Theory]
    [InlineData(AssignmentType.Execution, true)]
    [InlineData(AssignmentType.Estates, false)]
    [InlineData(AssignmentType.PrivateSector, false)]
    public void RequiresAssignmentDecree_only_for_execution(AssignmentType type, bool expected) =>
        Assert.Equal(expected, WorkOrderValidator.RequiresAssignmentDecree(type));

    [Fact]
    public void ValidateHeader_returns_no_errors_for_valid_request()
    {
        var errors = WorkOrderValidator.ValidateHeader(ValidCreateRequest());

        Assert.Empty(errors);
    }

    [Fact]
    public void ValidateHeader_collects_required_field_errors()
    {
        var errors = WorkOrderValidator.ValidateHeader(new CreateWorkOrderRequest());

        Assert.Contains("poNumber", errors.Keys);
        Assert.Contains("assignmentType", errors.Keys);
        Assert.Contains("promulgationDate", errors.Keys);
        Assert.DoesNotContain(errors, e => e.Key == "assignmentSpecialist");
        Assert.DoesNotContain(errors, e => e.Key == "assignmentSpecialistEmail");
    }

    [Fact]
    public void ValidateHeader_allows_empty_specialist_fields()
    {
        var request = ValidCreateRequest();
        request.AssignmentSpecialist = "";
        request.AssignmentSpecialistEmail = "";

        var errors = WorkOrderValidator.ValidateHeader(request);

        Assert.Empty(errors);
    }

    [Fact]
    public void ValidateHeader_rejects_invalid_specialist_email_when_provided()
    {
        var request = ValidCreateRequest();
        request.AssignmentSpecialistEmail = "not-an-email";

        var errors = WorkOrderValidator.ValidateHeader(request);

        Assert.Equal("صيغة الإيميل غير صالحة", errors["assignmentSpecialistEmail"]);
    }

    [Fact]
    public void ValidateHeader_rejects_zero_expected_property_count()
    {
        var request = ValidCreateRequest();
        request.ExpectedPropertyCount = 0;

        var errors = WorkOrderValidator.ValidateHeader(request);

        Assert.Equal("عدد العقارات يجب أن يكون 1 على الأقل", errors["expectedPropertyCount"]);
    }

    [Fact]
    public void ValidateUpdateHeader_skips_po_number_but_validates_rest()
    {
        var errors = WorkOrderValidator.ValidateUpdateHeader(new UpdateWorkOrderHeaderRequest
        {
            AssignmentType = AssignmentTypeLabels.Execution,
            PromulgationDate = "2026-06-07",
            AssignmentSpecialist = "Feras",
            AssignmentSpecialistEmail = "feras@ejadah.dev",
            ExpectedPropertyCount = 2,
        });

        Assert.Empty(errors);
        Assert.DoesNotContain(errors, e => e.Key == "poNumber");
    }

    [Fact]
    public void ValidatePropertyEnfath_requires_assignment_doc_for_execution()
    {
        var dto = ValidDeedProperty();
        dto.AssignmentDocFileName = null;

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Execution,
            "PO-1",
            null,
            (_, _) => false);

        Assert.Equal(
            "ارفع قرار الإسناد الخاص بهذا العقار (مطلوب لمسار التنفيذ)",
            errors["assignmentDocFileName"]);
    }

    [Fact]
    public void ValidatePropertyEnfath_requires_real_estate_reg_file_for_registration_type()
    {
        var dto = ValidDeedProperty();
        dto.IdentifierType = PropertyIdentifierTypeLabels.RealEstateReg;
        dto.RealEstateRegFileName = null;
        dto.AssignmentDocFileName = "decree.pdf";

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.Contains("realEstateRegFileName", errors.Keys);
        Assert.DoesNotContain(errors, e => e.Key == "assignmentDocFileName");
    }

    [Fact]
    public void ValidatePropertyEnfath_rejects_duplicate_deed_in_same_po()
    {
        var dto = ValidDeedProperty();
        dto.DeedNumber = "12345";

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (deed, _) => deed == "12345");

        Assert.Equal("رقم الصك مسجّل مسبقاً في هذا أمر العمل", errors["deedNumber"]);
    }

    [Fact]
    public void ValidatePropertyEnfath_allows_same_deed_when_excluding_current_property()
    {
        var propertyId = Guid.NewGuid();
        var dto = ValidDeedProperty();
        dto.DeedNumber = "12345";

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            propertyId,
            (deed, excludeId) => deed == "12345" && excludeId != propertyId);

        Assert.DoesNotContain(errors, e => e.Key == "deedNumber");
    }

    [Fact]
    public void ValidatePropertyBourse_requires_core_location_fields()
    {
        var errors = WorkOrderValidator.ValidatePropertyBourse(new UpdatePropertyBourseRequest());

        Assert.Contains("city", errors.Keys);
        Assert.Contains("district", errors.Keys);
        Assert.Contains("classification", errors.Keys);
        Assert.Contains("propertyType", errors.Keys);
    }

    [Fact]
    public void ValidatePropertyBourse_rejects_invalid_restrictions_and_boundaries()
    {
        var errors = WorkOrderValidator.ValidatePropertyBourse(new UpdatePropertyBourseRequest
        {
            City = "Riyadh",
            District = "Al Olaya",
            Classification = "residential",
            PropertyType = "land",
            RestrictionsPresent = "maybe",
            BoundariesAvailability = "unknown",
        });

        Assert.Equal("قيمة القيود غير صالحة", errors["restrictionsPresent"]);
        Assert.Equal("قيمة توفر الحدود غير صالحة", errors["boundariesAvailability"]);
    }

    [Fact]
    public void ValidatePropertyBourse_allows_empty_external_doc_when_boundaries_doc_selected()
    {
        var errors = WorkOrderValidator.ValidatePropertyBourse(new UpdatePropertyBourseRequest
        {
            City = "Riyadh",
            District = "Al Olaya",
            Classification = "residential",
            PropertyType = "land",
            BoundariesAvailability = "doc",
        });

        Assert.DoesNotContain("boundariesExternalDocName", errors.Keys);
    }

    private static CreateWorkOrderRequest ValidCreateRequest() => new()
    {
        PoNumber = "PO-100",
        AssignmentType = AssignmentTypeLabels.Execution,
        PromulgationDate = "2026-06-07",
        AssignmentSpecialist = "Feras",
        AssignmentSpecialistEmail = "feras@ejadah.dev",
        ExpectedPropertyCount = 1,
    };

    private static WorkOrderPropertyDto ValidDeedProperty() => new()
    {
        IdentifierType = PropertyIdentifierTypeLabels.Deed,
        DeedNumber = "98765",
        TaskNumber = "T-1",
        DeedDate = "2026-01-01",
        OwnerName = "Owner",
        DelegationLetterFileName = "letter.pdf",
        Contacts =
        [
            new PropertyContactDto { Phone = "0501234567", Role = "ضابط" },
        ],
    };
}
