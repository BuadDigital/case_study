using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Platform.Application.Abstractions;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/organization-settings")]
[Authorize]
public sealed class OrganizationSettingsController(
    IOrganizationSettingsService settings,
    IOtpDeliveryService otpDelivery) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<OrganizationSettingsDto>> Get(CancellationToken ct)
        => Ok(await settings.GetAsync(ct));

    /// <summary>
    /// Uploaded logos only — the login page shows them before anyone signs in, so nothing
    /// else from the settings is exposed here.
    /// </summary>
    [HttpGet("brand-logos")]
    [AllowAnonymous]
    public async Task<ActionResult<OrganizationBrandLogosDto>> BrandLogos(CancellationToken ct)
    {
        var branding = (await settings.GetAsync(ct)).Branding;
        return Ok(new OrganizationBrandLogosDto
        {
            LogoColorUrl = string.IsNullOrWhiteSpace(branding.LogoColorUrl) ? null : branding.LogoColorUrl,
            LogoWhiteUrl = string.IsNullOrWhiteSpace(branding.LogoWhiteUrl) ? null : branding.LogoWhiteUrl,
            UpdatedAt = branding.LogoUpdatedAt,
        });
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<OrganizationSettingsDto>> Save(
        [FromBody] SaveOrganizationSettingsRequest request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await settings.SaveAsync(request, ActorClaims.Id(User), ct));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return this.BadRequestProblem(ex.Message);
        }
    }

    [HttpPost("test-communication")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<TestCommunicationResultDto>> TestCommunication(
        [FromBody] TestCommunicationRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Destination))
            return this.BadRequestProblem("أدخل وجهة الاختبار (جوال أو بريد).");

        var result = await otpDelivery.SendTestAsync(
            request.Channel,
            request.Destination.Trim(),
            ct);
        return Ok(new TestCommunicationResultDto
        {
            Ok = result.Ok,
            Provider = result.Provider,
            Detail = result.Detail,
        });
    }
}