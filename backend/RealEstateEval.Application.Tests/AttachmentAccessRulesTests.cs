using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class AttachmentAccessRulesTests
{
    [Theory]
    [InlineData("prop-1", "prop-1", true)]
    [InlineData("prop-1:slot:front", "prop-1", true)]
    [InlineData("prop-1/photos", "prop-1", true)]
    [InlineData("prop-10", "prop-1", false)]
    [InlineData("other-prop-1-extra", "prop-1", false)]
    [InlineData("prop-1", "prop-2", false)]
    public void ScopeKeyMatchesProperty_rejects_raw_substring(string scopeKey, string propertyId, bool expected)
    {
        Assert.Equal(expected, AttachmentAccessRules.ScopeKeyMatchesProperty(scopeKey, propertyId));
    }

    [Fact]
    public void Allows_uploader_and_managers()
    {
        Assert.True(AttachmentAccessRules.Allows("owner-1", new PermissionsDto
        {
            UserId = "owner-1",
            PrototypeRole = "field-inspector",
        }));
        Assert.False(AttachmentAccessRules.Allows("owner-1", new PermissionsDto
        {
            UserId = "other",
            PrototypeRole = "field-inspector",
        }));
        Assert.True(AttachmentAccessRules.Allows("owner-1", new PermissionsDto
        {
            UserId = "staff",
            PrototypeRole = "case-specialist",
        }));
        Assert.True(AttachmentAccessRules.Allows("owner-1", new PermissionsDto
        {
            UserId = "lib",
            PrototypeRole = "document-controller",
            Capabilities = [PlatformCapabilities.ManageAttachments],
        }));
    }

    [Fact]
    public void Allows_operational_capabilities_to_read_foreign_uploads()
    {
        Assert.True(AttachmentAccessRules.Allows("owner-1", new PermissionsDto
        {
            UserId = "finance-staff",
            PrototypeRole = "financial-officer",
            Capabilities = [PlatformCapabilities.ManageFinancial],
        }));
        Assert.True(AttachmentAccessRules.Allows("owner-1", new PermissionsDto
        {
            UserId = "ops-staff",
            PrototypeRole = "operations-coordinator",
            Capabilities = [PlatformCapabilities.ManageOperations],
        }));
        Assert.False(AttachmentAccessRules.Allows("owner-1", new PermissionsDto
        {
            UserId = "random",
            PrototypeRole = "field-inspector",
            Capabilities = [PlatformCapabilities.SubmitPartyWork],
        }));
    }
}
