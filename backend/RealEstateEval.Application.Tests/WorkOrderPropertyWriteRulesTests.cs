using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class WorkOrderPropertyWriteRulesTests
{
    private static WorkOrder OrderWith(params WorkOrderProperty[] properties)
    {
        var order = new WorkOrder { Id = Guid.NewGuid(), PoNumber = "PO-1" };
        foreach (var property in properties) order.Properties.Add(property);
        return order;
    }

    // ---- edit eligibility ----

    [Fact]
    public void Editable_property_must_exist_on_the_order()
    {
        var order = OrderWith();
        var errors = WorkOrderPropertyWriteRules.FindEditableProperty(order, Guid.NewGuid(), out var found);

        Assert.Null(found);
        Assert.Equal("العقار غير موجود", errors!["_"]);
    }

    [Fact]
    public void Removed_property_cannot_be_edited()
    {
        var property = new WorkOrderProperty { Id = Guid.NewGuid(), IsRemoved = true };
        var errors = WorkOrderPropertyWriteRules.FindEditableProperty(
            OrderWith(property),
            property.Id,
            out var found);

        Assert.Null(found);
        Assert.Equal("لا يمكن تعديل عقار محذوف", errors!["_"]);
    }

    [Fact]
    public void Live_property_is_returned_without_errors()
    {
        var property = new WorkOrderProperty { Id = Guid.NewGuid() };
        var errors = WorkOrderPropertyWriteRules.FindEditableProperty(
            OrderWith(property),
            property.Id,
            out var found);

        Assert.Null(errors);
        Assert.Same(property, found);
    }

    [Fact]
    public void Deed_probe_ignores_removed_rows_and_the_excluded_property()
    {
        var kept = new WorkOrderProperty { Id = Guid.NewGuid(), DeedNumber = "D-1" };
        var removed = new WorkOrderProperty { Id = Guid.NewGuid(), DeedNumber = "D-2", IsRemoved = true };
        var probe = WorkOrderPropertyWriteRules.DeedTakenProbe(OrderWith(kept, removed));

        Assert.True(probe(" D-1 ", null));
        Assert.False(probe("D-1", kept.Id));
        Assert.False(probe("D-2", null));
    }

    [Fact]
    public void Merge_errors_keeps_the_first_message_per_field()
    {
        var merged = WorkOrderPropertyWriteRules.MergeErrors(
            new Dictionary<string, string> { ["city"] = "أولاً", ["district"] = "الحي" },
            new Dictionary<string, string> { ["city"] = "ثانياً" });

        Assert.Equal("أولاً", merged["city"]);
        Assert.Equal("الحي", merged["district"]);
    }

    // ---- small validations ----

    [Fact]
    public void Delete_reason_is_required_and_bounded()
    {
        Assert.Equal("سبب الحذف مطلوب", WorkOrderPropertyWriteRules.ValidateDeleteReason("  ").Error);
        Assert.Equal(
            "سبب الحذف طويل جداً",
            WorkOrderPropertyWriteRules.ValidateDeleteReason(new string('x', 501)).Error);

        var (error, reason) = WorkOrderPropertyWriteRules.ValidateDeleteReason("  مكرر  ");
        Assert.Null(error);
        Assert.Equal("مكرر", reason);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(2, 1)]
    [InlineData(5, 4)]
    public void Expected_count_never_drops_below_one(int before, int after)
    {
        Assert.Equal(after, WorkOrderPropertyWriteRules.ExpectedCountAfterRemoval(before));
    }

    [Fact]
    public void Location_map_url_must_be_http_or_empty()
    {
        Assert.Null(WorkOrderPropertyWriteRules.ValidateLocationMapUrl("   ").Errors);
        Assert.Null(WorkOrderPropertyWriteRules.ValidateLocationMapUrl("   ").Value);

        var bad = WorkOrderPropertyWriteRules.ValidateLocationMapUrl("maps.example");
        Assert.Equal("رابط الموقع يجب أن يبدأ بـ http:// أو https://", bad.Errors!["locationMapUrl"]);

        var good = WorkOrderPropertyWriteRules.ValidateLocationMapUrl(" https://maps.example/x ");
        Assert.Null(good.Errors);
        Assert.Equal("https://maps.example/x", good.Value);
    }

    [Fact]
    public void Specialist_report_extras_accepts_json_or_clears()
    {
        Assert.Null(WorkOrderPropertyWriteRules.ValidateSpecialistReportExtras("null").Value);
        Assert.Null(WorkOrderPropertyWriteRules.ValidateSpecialistReportExtras("  ").Value);

        var invalid = WorkOrderPropertyWriteRules.ValidateSpecialistReportExtras("{not json");
        Assert.Equal("صيغة JSON غير صالحة", invalid.Errors!["specialistReportExtrasJson"]);

        var tooBig = "[\"" + new string('x', 70_000) + "\"]";
        Assert.Equal(
            "حجم البيانات أكبر من المسموح",
            WorkOrderPropertyWriteRules.ValidateSpecialistReportExtras(tooBig).Errors!["specialistReportExtrasJson"]);

        var ok = WorkOrderPropertyWriteRules.ValidateSpecialistReportExtras("  {\"a\":1}  ");
        Assert.Null(ok.Errors);
        Assert.Equal("{\"a\":1}", ok.Value);
    }

    [Fact]
    public void Concurrency_message_names_the_clashing_entities_when_known()
    {
        Assert.Equal(
            "تعذّر حفظ العقار — أعد تحميل الصفحة وحاول مرة أخرى",
            WorkOrderPropertyWriteRules.ConcurrencyErrors("")["_"]);
        Assert.Contains(
            "(PropertyContact:Deleted)",
            WorkOrderPropertyWriteRules.ConcurrencyErrors("PropertyContact:Deleted")["_"]);
    }

    [Fact]
    public void Bourse_timeline_location_joins_the_non_empty_parts()
    {
        Assert.Equal("الرياض · النرجس", WorkOrderPropertyWriteRules.BourseTimelineLocation(" الرياض ", "النرجس"));
        Assert.Equal("الرياض", WorkOrderPropertyWriteRules.BourseTimelineLocation("الرياض", "  "));
        Assert.Null(WorkOrderPropertyWriteRules.BourseTimelineLocation(null, null));
    }

    // ---- normalisation ----

    [Fact]
    public void Restriction_type_keeps_known_kinds_once_and_only_when_present()
    {
        Assert.Null(WorkOrderPropertyWriteRules.NormalizeRestrictionType("no", "mortgaged"));
        Assert.Null(WorkOrderPropertyWriteRules.NormalizeRestrictionType("yes", "unknown-kind"));
        Assert.Equal(
            "mortgaged,seized",
            WorkOrderPropertyWriteRules.NormalizeRestrictionType("YES", "Mortgaged، seized ,mortgaged"));
    }

    [Fact]
    public void Restriction_other_reason_survives_only_for_the_other_kind()
    {
        Assert.Null(WorkOrderPropertyWriteRules.NormalizeRestrictionOtherReason("no", "other", "س"));
        Assert.Null(WorkOrderPropertyWriteRules.NormalizeRestrictionOtherReason("yes", "seized", "س"));
        Assert.Equal(
            "سبب",
            WorkOrderPropertyWriteRules.NormalizeRestrictionOtherReason("yes", "seized,other", "  سبب  "));
    }

    [Fact]
    public void Known_codes_are_lowercased_and_unknown_text_is_kept()
    {
        Assert.Null(WorkOrderPropertyWriteRules.NormalizeBoundaryType("   "));
        Assert.Equal("شارع خاص", WorkOrderPropertyWriteRules.NormalizeBoundaryType(" شارع خاص "));

        var known = PropertyBoundaryTypes.All.First();
        Assert.Equal(
            known.ToLowerInvariant(),
            WorkOrderPropertyWriteRules.NormalizeBoundaryType(known.ToUpperInvariant()));
    }

    // ---- contacts ----

    [Fact]
    public void Contacts_without_phone_or_role_are_dropped_and_the_rest_are_ordered()
    {
        var propertyId = Guid.NewGuid();
        var rows = WorkOrderPropertyWriteRules.BuildContacts(propertyId, [
            new PropertyContactDto { Name = " أحمد ", Role = " مالك ", Phone = " 05 " },
            new PropertyContactDto { Name = "بدون", Role = "", Phone = "" },
            new PropertyContactDto { Name = "", Role = "وكيل", Phone = "" },
        ]);

        Assert.Equal(2, rows.Count);
        Assert.Equal(propertyId, rows[0].PropertyId);
        Assert.Equal("أحمد", rows[0].Name);
        Assert.Equal("مالك", rows[0].Role);
        Assert.Equal("05", rows[0].Phone);
        Assert.Equal([0, 1], rows.Select(r => r.SortOrder));
    }

    [Fact]
    public void Replace_contacts_can_clear_the_existing_list_first()
    {
        var entity = new WorkOrderProperty { Id = Guid.NewGuid() };
        entity.Contacts.Add(new PropertyContact { Id = Guid.NewGuid(), Role = "قديم" });

        WorkOrderPropertyWriteRules.ReplacePropertyContacts(
            entity,
            [new PropertyContactDto { Role = "جديد", Phone = "05" }],
            clearExisting: true);

        Assert.Equal("جديد", Assert.Single(entity.Contacts).Role);
    }

    // ---- enfath / bourse application ----

    [Fact]
    public void Enfath_generates_a_placeholder_deed_for_a_bourse_inquiry()
    {
        var dto = new WorkOrderPropertyDto
        {
            IdentifierType = PropertyIdentifierTypeLabels.ToApiValue(PropertyIdentifierType.BourseInquiry),
            DeedNumber = "",
        };
        var orderId = Guid.NewGuid();

        var entity = WorkOrderPropertyWriteRules.NewPropertyFromEnfath(dto, orderId, forInsert: true);

        Assert.Equal(orderId, entity.WorkOrderId);
        Assert.False(entity.BourseDataCompleted);
        Assert.StartsWith("INQ-", entity.DeedNumber);
        Assert.Equal(12, entity.DeedNumber.Length);
    }

    [Fact]
    public void Enfath_trims_the_deed_and_serializes_the_document_lists()
    {
        var dto = new WorkOrderPropertyDto
        {
            DeedNumber = "  D-7 ",
            District = "  النرجس ",
            AssignmentDocFileNames = [" a.pdf ", "  "],
            DelegationLetterFileNames = [],
            SpecialistReportExtrasJson = "null",
        };
        var entity = new WorkOrderProperty { Id = Guid.NewGuid() };

        WorkOrderPropertyWriteRules.ApplyPropertyEnfath(entity, dto);

        Assert.Equal("D-7", entity.DeedNumber);
        Assert.Equal("النرجس", entity.District);
        Assert.Equal(["a.pdf"], PropertyFileNameList.Parse(entity.AssignmentDocFileName));
        Assert.Null(entity.DelegationLetterFileName);
        Assert.Null(entity.SpecialistReportExtrasJson);
    }

    [Fact]
    public void Bourse_request_completes_the_property_when_boundaries_are_available()
    {
        var entity = new WorkOrderProperty { Id = Guid.NewGuid() };
        var now = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc);
        var request = new UpdatePropertyBourseRequest
        {
            City = " الرياض ",
            District = " النرجس ",
            Classification = " سكني ",
            PropertyType = " أرض ",
            BoundariesAvailability = "available",
            NorthBoundary = " شارع ",
        };

        var (errors, unavailable) = WorkOrderPropertyWriteRules.ApplyBourseRequest(entity, request, now);

        Assert.Null(errors);
        Assert.False(unavailable);
        Assert.Equal("الرياض", entity.City);
        Assert.Equal("شارع", entity.NorthBoundary);
        Assert.True(entity.BourseDataCompleted);
        Assert.Equal(now, entity.BourseCompletedAtUtc);
    }

    [Fact]
    public void Bourse_request_leaves_the_property_open_when_boundaries_are_unavailable()
    {
        var entity = new WorkOrderProperty { Id = Guid.NewGuid() };
        var request = new UpdatePropertyBourseRequest
        {
            City = "الرياض",
            District = "النرجس",
            Classification = "سكني",
            PropertyType = "أرض",
            BoundariesAvailability = "no",
        };

        var (errors, unavailable) = WorkOrderPropertyWriteRules.ApplyBourseRequest(
            entity,
            request,
            DateTime.UtcNow);

        Assert.Null(errors);
        Assert.True(unavailable);
        Assert.False(entity.BourseDataCompleted);
        Assert.Null(entity.BourseCompletedAtUtc);
    }

    [Fact]
    public void Bourse_request_rejects_an_unknown_manual_ownership_type()
    {
        var entity = new WorkOrderProperty { Id = Guid.NewGuid() };
        var request = new UpdatePropertyBourseRequest
        {
            City = "الرياض",
            District = "النرجس",
            Classification = "سكني",
            PropertyType = "أرض",
            OwnershipTypeIsManual = true,
            OwnershipType = "not-a-type",
        };

        var (errors, _) = WorkOrderPropertyWriteRules.ApplyBourseRequest(entity, request, DateTime.UtcNow);
        Assert.Equal("نوع ملكية غير معروف", errors!["ownershipType"]);
    }

    [Fact]
    public void Bourse_request_clears_a_derived_ownership_type()
    {
        var entity = new WorkOrderProperty
        {
            Id = Guid.NewGuid(),
            OwnershipType = "absolute",
            OwnershipTypeIsManual = true,
        };
        var request = new UpdatePropertyBourseRequest
        {
            City = "الرياض",
            District = "النرجس",
            Classification = "سكني",
            PropertyType = "أرض",
            OwnershipTypeIsManual = false,
        };

        WorkOrderPropertyWriteRules.ApplyBourseRequest(entity, request, DateTime.UtcNow);

        Assert.Null(entity.OwnershipType);
        Assert.False(entity.OwnershipTypeIsManual);
    }

    [Fact]
    public void Bourse_request_stores_named_owners_and_names_the_first_one()
    {
        var entity = new WorkOrderProperty { Id = Guid.NewGuid() };
        var request = new UpdatePropertyBourseRequest
        {
            City = "الرياض",
            District = "النرجس",
            Classification = "سكني",
            PropertyType = "أرض",
            Owners =
            [
                new DeedOwnerDto { Name = " سالم ", SharePct = 60 },
                new DeedOwnerDto { Name = "  ", SharePct = 0 },
                new DeedOwnerDto { Name = "نورة", SharePct = 40 },
            ],
        };

        var (errors, _) = WorkOrderPropertyWriteRules.ApplyBourseRequest(entity, request, DateTime.UtcNow);

        Assert.Null(errors);
        Assert.Equal("سالم", entity.OwnerName);
        Assert.NotNull(entity.DeedOwnersJson);
    }

    // ---- stored file-name column ----

    [Fact]
    public void File_name_list_reads_json_and_legacy_single_names()
    {
        Assert.Equal(["a.pdf", "b.pdf"], PropertyFileNameList.Parse("[\"a.pdf\",\" b.pdf \"]"));
        Assert.Equal(["legacy.pdf"], PropertyFileNameList.Parse(" legacy.pdf "));
        Assert.Empty(PropertyFileNameList.Parse("  "));
        Assert.Empty(PropertyFileNameList.Parse("[not json"));
        Assert.False(PropertyFileNameList.HasAny(null));
        Assert.True(PropertyFileNameList.HasAny("x.pdf"));
        Assert.Null(PropertyFileNameList.Serialize([" ", ""]));
    }
}
