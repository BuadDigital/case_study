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
    IOrganizationSettingsGapService gaps,
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

    /// <summary>Who last changed each settings section the valuation report reads.</summary>
    [HttpGet("section-editors")]
    public async Task<ActionResult<OrganizationSettingsSectionEditorsDto>> SectionEditors(CancellationToken ct)
        => Ok(await gaps.GetSectionEditorsAsync(ct));

    /// <summary>Valuation report: ask the last editor of a settings section to fill an empty value.</summary>
    [HttpPost("notify-gap")]
    public async Task<ActionResult<NotifyOrganizationSettingsGapResultDto>> NotifyGap(
        [FromBody] NotifyOrganizationSettingsGapRequest request,
        CancellationToken ct)
    {
        var (count, recipient, error) = await gaps.NotifyAsync(
            request ?? new NotifyOrganizationSettingsGapRequest(),
            ActorClaims.DisplayName(User),
            ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(new NotifyOrganizationSettingsGapResultDto
        {
            NotifiedCount = count,
            RecipientName = recipient,
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
