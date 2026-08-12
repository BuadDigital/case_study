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

    [Theory]
    [InlineData(AssignmentType.Execution, true)]
    [InlineData(AssignmentType.Estates, false)]
    [InlineData(AssignmentType.PrivateSector, false)]
    public void Court_path_only_for_execution(AssignmentType type, bool expected)
    {
        Assert.Equal(expected, AssignmentTypeRules.RequiresCourtAndCircuit(type));
        Assert.Equal(expected, AssignmentTypeRules.RequiresRequestNumber(type));
        Assert.Equal(expected, AssignmentTypeRules.IsCourtPath(type));
    }

    [Theory]
    [InlineData(AssignmentType.Execution, true)]
    [InlineData(AssignmentType.Estates, true)]
    [InlineData(AssignmentType.PrivateSector, false)]
    public void Contacts_required_except_private(AssignmentType type, bool expected) =>
        Assert.Equal(expected, AssignmentTypeRules.RequiresContacts(type));

    [Theory]
    [InlineData(AssignmentType.Execution, 4)]
    [InlineData(AssignmentType.Estates, 4)]
    [InlineData(AssignmentType.PrivateSector, 10)]
    public void Business_days_by_assignment_type(AssignmentType type, int expected) =>
        Assert.Equal(expected, AssignmentTypeRules.BusinessDaysRequired(type));

    [Fact]
    public void ValidatePropertyEnfath_skips_court_for_estates()
    {
        var dto = ValidDeedProperty();
        dto.Court = null;
        dto.Circuit = null;
        dto.RequestNumber = null;
        dto.HasRequestNumber = true;

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.DoesNotContain(errors, e => e.Key == "court");
        Assert.DoesNotContain(errors, e => e.Key == "circuit");
        Assert.DoesNotContain(errors, e => e.Key == "requestNumber");
    }

    [Fact]
    public void ValidatePropertyEnfath_allows_empty_contacts_for_private()
    {
        var dto = ValidDeedProperty();
        dto.Court = null;
        dto.Circuit = null;
        dto.Contacts = [];

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.PrivateSector,
            "PO-1",
            null,
            (_, _) => false);

        Assert.DoesNotContain(errors, e => e.Key == "_contacts");
        Assert.DoesNotContain(errors, e => e.Key == "court");
    }

    [Fact]
    public void ValidatePropertyEnfath_requires_court_for_execution()
    {
        var dto = ValidDeedProperty();
        dto.Court = null;
        dto.Circuit = null;
        dto.AssignmentDocFileNames = ["decree.pdf"];

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Execution,
            "PO-1",
            null,
            (_, _) => false);

        Assert.Equal("المحكمة مطلوبة", errors["court"]);
        Assert.Equal("الدائرة مطلوبة", errors["circuit"]);
    }
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
    public void ValidatePropertyEnfath_requires_assignment_doc()
    {
        var dto = ValidDeedProperty();
        dto.AssignmentDocFileNames = [];

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Execution,
            "PO-1",
            null,
            (_, _) => false);

        Assert.Equal("خطاب الإسناد مطلوب", errors["assignmentDocFileNames"]);
    }

    [Fact]
    public void ValidatePropertyEnfath_requires_real_estate_reg_file_for_registration_type()
    {
        var dto = ValidDeedProperty();
        dto.IdentifierType = PropertyIdentifierTypeLabels.RealEstateReg;
        dto.DeedNumber = "";
        dto.DeedDate = null;
        dto.RealEstateRegNumber = "1234567890123456";
        dto.RealEstateRegDate = "2026-01-01";
        dto.RealEstateRegFileName = null;
        dto.AssignmentDocFileNames = ["decree.pdf"];

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.Contains("realEstateRegFileName", errors.Keys);
        Assert.DoesNotContain(errors, e => e.Key == "assignmentDocFileNames");
    }

    [Fact]
    public void ValidatePropertyEnfath_allows_deed_without_real_estate_reg()
    {
        var dto = ValidDeedProperty();
        dto.IdentifierType = PropertyIdentifierTypeLabels.RealEstateReg;
        dto.RealEstateRegNumber = null;
        dto.RealEstateRegDate = null;
        dto.RealEstateRegFileName = null;
        dto.AssignmentDocFileNames = ["decree.pdf"];

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.DoesNotContain(errors, e => e.Key == "realEstateRegNumber");
        Assert.DoesNotContain(errors, e => e.Key == "deedNumber");
    }

    [Fact]
    public void ValidatePropertyEnfath_requires_deed_or_real_estate_reg()
    {
        var dto = ValidDeedProperty();
        dto.DeedNumber = "";
        dto.DeedDate = null;
        dto.RealEstateRegNumber = null;
        dto.RealEstateRegDate = null;
        dto.RealEstateRegFileName = null;
        dto.AssignmentDocFileNames = ["decree.pdf"];

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.Equal("أدخل رقم الصك أو رقم التسجيل العيني", errors["deedNumber"]);
        Assert.Equal("أدخل رقم الصك أو رقم التسجيل العيني", errors["realEstateRegNumber"]);
        Assert.DoesNotContain(errors, e => e.Key == "deedDate");
    }

    [Fact]
    public void ValidatePropertyEnfath_allows_real_estate_reg_without_deed()
    {
        var dto = ValidDeedProperty();
        dto.DeedNumber = "";
        dto.DeedDate = null;
        dto.RealEstateRegNumber = "1234567890123456";
        dto.RealEstateRegDate = "2026-01-01";
        dto.RealEstateRegFileName = "registry.pdf";
        dto.AssignmentDocFileNames = ["decree.pdf"];

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.DoesNotContain(errors, e => e.Key == "deedNumber");
        Assert.DoesNotContain(errors, e => e.Key == "realEstateRegNumber");
    }

    [Fact]
    public void ValidatePropertyEnfath_allows_deed_without_deed_date()
    {
        var dto = ValidDeedProperty();
        dto.DeedDate = null;
        dto.AssignmentDocFileNames = ["decree.pdf"];

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.DoesNotContain(errors, e => e.Key == "deedDate");
    }

    [Fact]
    public void ValidatePropertyEnfath_allows_skipping_request_number_when_unchecked()
    {
        var dto = ValidDeedProperty();
        dto.HasRequestNumber = false;
        dto.RequestNumber = null;
        dto.AssignmentDocFileNames = ["decree.pdf"];

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.DoesNotContain(errors, e => e.Key == "requestNumber");
    }

    [Fact]
    public void ValidatePropertyEnfath_rejects_duplicate_deed_in_same_po()
    {
        var dto = ValidDeedProperty();
        dto.DeedNumber = "123450000001";

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (deed, _) => deed == "123450000001");

        Assert.Equal("رقم الصك مسجّل مسبقاً في هذا أمر العمل", errors["deedNumber"]);
    }

    [Fact]
    public void ValidatePropertyEnfath_allows_same_deed_when_excluding_current_property()
    {
        var propertyId = Guid.NewGuid();
        var dto = ValidDeedProperty();
        dto.DeedNumber = "123450000001";

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            propertyId,
            (deed, excludeId) => deed == "123450000001" && excludeId != propertyId);

        Assert.DoesNotContain(errors, e => e.Key == "deedNumber");
    }

    [Fact]
    public void ValidatePropertyEnfath_rejects_deed_with_wrong_digit_length()
    {
        var dto = ValidDeedProperty();
        dto.DeedNumber = "12345";

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.Equal("رقم الصك يجب أن يكون 12 رقماً", errors["deedNumber"]);
    }

    [Fact]
    public void ValidatePropertyEnfath_requires_sixteen_digits_for_real_estate_registration()
    {
        var dto = ValidDeedProperty();
        dto.IdentifierType = PropertyIdentifierTypeLabels.RealEstateReg;
        dto.DeedNumber = "";
        dto.DeedDate = null;
        dto.RealEstateRegFileName = "registry.pdf";
        dto.RealEstateRegDate = "2026-01-01";
        dto.RealEstateRegNumber = "123450000001";

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            dto,
            AssignmentType.Estates,
            "PO-1",
            null,
            (_, _) => false);

        Assert.Equal("تسجيل عيني يجب أن يكون 16 رقماً", errors["realEstateRegNumber"]);
    }

    [Fact]
    public void ValidatePropertyBourse_requires_core_location_fields()
    {
        var errors = WorkOrderValidator.ValidatePropertyBourse(new UpdatePropertyBourseRequest());

        Assert.Contains("city", errors.Keys);
        Assert.Contains("district", errors.Keys);
        Assert.Contains("bourseDeedImageFileName", errors.Keys);
        Assert.DoesNotContain("classification", errors.Keys);
        Assert.DoesNotContain("propertyType", errors.Keys);
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
            BourseDeedImageFileName = "deed.png",
            RestrictionsPresent = "maybe",
            BoundariesAvailability = "unknown",
        });

        Assert.Equal("قيمة القيود غير صالحة", errors["restrictionsPresent"]);
        Assert.Equal("قيمة توفر الحدود غير صالحة", errors["boundariesAvailability"]);
    }

    [Fact]
    public void ValidatePropertyBourse_requires_restriction_type_when_restrictions_present()
    {
        var errors = WorkOrderValidator.ValidatePropertyBourse(new UpdatePropertyBourseRequest
        {
            City = "Riyadh",
            District = "Al Olaya",
            BourseDeedImageFileName = "deed.png",
            RestrictionsPresent = "yes",
        });

        Assert.Equal("اختر نوع قيد واحداً على الأقل", errors["restrictionType"]);
    }

    [Fact]
    public void ValidatePropertyBourse_requires_other_reason_when_restriction_type_other()
    {
        var errors = WorkOrderValidator.ValidatePropertyBourse(new UpdatePropertyBourseRequest
        {
            City = "Riyadh",
            District = "Al Olaya",
            BourseDeedImageFileName = "deed.png",
            RestrictionsPresent = "yes",
            RestrictionType = "other",
        });

        Assert.Equal("سبب القيد مطلوب عند اختيار أخرى", errors["restrictionOtherReason"]);
    }

    [Fact]
    public void ValidatePropertyBourse_allows_multiple_restriction_types()
    {
        var errors = WorkOrderValidator.ValidatePropertyBourse(new UpdatePropertyBourseRequest
        {
            City = "Riyadh",
            District = "Al Olaya",
            Classification = "residential",
            PropertyType = "land",
            BourseDeedImageFileName = "deed.png",
            RestrictionsPresent = "yes",
            RestrictionType = "mortgaged,seized",
            BoundariesAvailability = "available",
        });

        Assert.DoesNotContain(errors, e => e.Key == "restrictionType");
        Assert.DoesNotContain(errors, e => e.Key == "restrictionOtherReason");
    }

    [Fact]
    public void ValidatePropertyBourse_requires_other_reason_when_other_among_multiple()
    {
        var errors = WorkOrderValidator.ValidatePropertyBourse(new UpdatePropertyBourseRequest
        {
            City = "Riyadh",
            District = "Al Olaya",
            BourseDeedImageFileName = "deed.png",
            RestrictionsPresent = "yes",
            RestrictionType = "mortgaged,other",
        });

        Assert.Equal("سبب القيد مطلوب عند اختيار أخرى", errors["restrictionOtherReason"]);
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
            BourseDeedImageFileName = "deed.png",
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
        DeedNumber = "987650000001",
        RequestNumber = "T-1",
        AssignmentMandateNumber = "M-1",
        AssignmentMandateDate = "2026-01-01",
        DeedDate = "2026-01-01",
        OwnerName = "Owner",
        Court = "محكمة التنفيذ",
        Circuit = "1",
        DelegationLetterFileNames = ["letter.pdf"],
        AssignmentDocFileNames = ["decree.pdf"],
        Contacts =
        [
            new PropertyContactDto { Phone = "0501234567", Role = "ضابط" },
        ],
    };
}
