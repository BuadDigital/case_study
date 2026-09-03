using RealEstateEval.Domain;
using RealEstateEval.Identity.Infrastructure.Permissions;

namespace RealEstateEval.Application.Tests;

public class PrototypeRoleResolverTests
{
    [Theory]
    [InlineData("cdo")]
    [InlineData("general-manager")]
    [InlineData("section-supervisor")]
    [InlineData("case-specialist")]
    [InlineData("government-reviewer")]
    [InlineData("real-estate-appraiser")]
    [InlineData("field-inspector")]
    [InlineData("financial-officer")]
    [InlineData("engineering-office")]
    public void Resolves_explicit_canonical_role_only(string roleId)
    {
        var profile = new UserProfile { RoleId = roleId, JobTitle = "عنوان حر" };
        Assert.Equal(roleId, PrototypeRoleResolver.Resolve(profile, Array.Empty<string>()));
    }

    [Theory]
    [InlineData("مشرف دراسة الحالة")]
    [InlineData("أخصائي دراسة الحالة")]
    [InlineData("case-specialist")]
    [InlineData("")]
    public void Job_title_never_grants_a_role(string jobTitle)
    {
        var profile = new UserProfile { JobTitle = jobTitle };
        Assert.Null(PrototypeRoleResolver.Resolve(profile, Array.Empty<string>()));
    }

    [Theory]
    [InlineData("government-reviewer", "مراجع حكومي")]
    [InlineData("field-inspector", "معاين ميداني")]
    public void JobTitleForRoleId_roundtrips_seeded_roles(string roleId, string jobTitle)
    {
        Assert.Equal(jobTitle, PrototypeRoleResolver.JobTitleForRoleId(roleId));
        Assert.Equal(roleId, PrototypeRoleResolver.Resolve(new UserProfile { RoleId = roleId }, []));
    }

    [Fact]
    public void IsCreatableStaffRoleId_allows_internal_and_provider_roles()
    {
        Assert.True(PrototypeRoleResolver.IsCreatableStaffRoleId("cdo"));
        Assert.True(PrototypeRoleResolver.IsCreatableStaffRoleId("engineering-office"));
        Assert.True(PrototypeRoleResolver.IsCreatableStaffRoleId("government-reviewer"));
    }
}
