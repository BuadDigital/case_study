using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.Application.Tests;

/// <summary>Omar 2026-11-12: the case staff add their own photos to a sent inspection, and the timeline says so.</summary>
public class StaffAddedPhotoRulesTests
{
    private const string InspectorOnly =
        """{"freePhotos":[{"id":1,"fileName":"a.jpg"},{"id":2,"fileName":"b.jpg","uploadedBy":"inspector"}]}""";

    [Fact]
    public void Counts_the_staff_photos_a_save_added_or_removed()
    {
        const string after =
            """{"freePhotos":[{"id":1,"fileName":"a.jpg"},{"id":2,"fileName":"b.jpg","uploadedBy":"inspector"},{"id":3,"fileName":"c.jpg","uploadedBy":"specialist"},{"id":4,"fileName":"d.jpg","uploadedBy":"specialist"}]}""";

        Assert.Equal((2, 0), StaffAddedPhotoRules.Change(InspectorOnly, after));
        Assert.Equal((0, 2), StaffAddedPhotoRules.Change(after, InspectorOnly));
    }

    [Fact]
    public void Counts_an_added_and_a_removed_photo_in_the_same_save()
    {
        const string before = """{"freePhotos":[{"id":3,"fileName":"c.jpg","uploadedBy":"specialist"}]}""";
        const string after = """{"freePhotos":[{"id":5,"fileName":"e.jpg","uploadedBy":"specialist"}]}""";

        Assert.Equal((1, 1), StaffAddedPhotoRules.Change(before, after));
    }

    [Fact]
    public void Ignores_the_inspectors_photos_and_unreadable_payloads()
    {
        // The inspector's photos coming and going is not the staff's change.
        Assert.Equal((0, 0), StaffAddedPhotoRules.Change("""{"freePhotos":[]}""", InspectorOnly));
        Assert.Equal((0, 0), StaffAddedPhotoRules.Change(null, ""));
        Assert.Equal((0, 0), StaffAddedPhotoRules.Change("not json", """{"freePhotos":"x"}"""));
        Assert.Equal((0, 0), StaffAddedPhotoRules.Change("""[1,2]""", """{"other":1}"""));
    }

    [Theory]
    [InlineData(1, "صورة واحدة")]
    [InlineData(2, "صورتان")]
    [InlineData(3, "3 صور")]
    [InlineData(10, "10 صور")]
    [InlineData(11, "11 صورة")]
    public void Says_the_count_in_arabic(int count, string expected) =>
        Assert.Equal(expected, StaffAddedPhotoRules.CountAr(count));

    [Fact]
    public void Names_who_did_it_when_known()
    {
        Assert.Equal("3 صور — أسامة الصالحي", StaffAddedPhotoRules.TimelineDetail(3, " أسامة الصالحي "));
        Assert.Equal("صورة واحدة", StaffAddedPhotoRules.TimelineDetail(1, " "));
    }
}
