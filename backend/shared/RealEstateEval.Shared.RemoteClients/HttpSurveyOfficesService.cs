using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpSurveyOfficesService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : ISurveyOfficesService
{
    private const string Setting = "UpstreamServices:OperationsBaseUrl";

    public async Task<IReadOnlyList<SurveyOfficeDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var list = await UpstreamJson.GetAsync<List<SurveyOfficeDto>>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            "/api/survey-offices",
            Setting,
            cancellationToken);
        return list;
    }

    public Task<SurveyOfficeDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.GetOrDefaultAsync<SurveyOfficeDto>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            $"/api/survey-offices/{id:D}",
            Setting,
            cancellationToken);
}
