using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Permissions;

namespace RealEstateEval.Application.Tests;

public class PrototypeRoleResolverTests
{
    [Theory]
    [InlineData("مسؤول التحول الرقمي (CDO)", "cdo")]
    [InlineData("أخصائية موارد بشرية", "hr-admin")]
    [InlineData("مدير المالية والعقود", "proc-admin")]
    [InlineData("مدير علاقات العملاء", "crm-admin")]
    [InlineData("مدير إدارة التقييم العقاري", "general-manager")]
    [InlineData("مشرف قسم دراسة الحالة", "section-supervisor")]
    [InlineData("أخصائي دراسة حالة", "case-specialist")]
    [InlineData("مراجع حكومي", "government-reviewer")]
    [InlineData("منسق عمليات التقييم", "valuation-coordinator")]
    [InlineData("مقيم عقاري", "real-estate-appraiser")]
    [InlineData("معاين ميداني", "field-inspector")]
    [InlineData("موظف الشؤون المالية", "financial-officer")]
    [InlineData("مقدم خدمة — جهة", "engineering-office")]
    public void Resolves_exact_seeded_job_titles_only(string jobTitle, string expected)
    {
        var profile = new UserProfile { JobTitle = jobTitle };
        Assert.Equal(expected, PrototypeRoleResolver.Resolve(profile, Array.Empty<string>()));
    }

    [Theory]
    [InlineData("مشرف دراسة الحالة")]
    [InlineData("أخصائي دراسة الحالة")]
    [InlineData("case-specialist")]
    [InlineData("")]
    public void Does_not_guess_unknown_or_variant_titles(string jobTitle)
    {
        var profile = new UserProfile { JobTitle = jobTitle };
        Assert.Null(PrototypeRoleResolver.Resolve(profile, Array.Empty<string>()));
    }
}
