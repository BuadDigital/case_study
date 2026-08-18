using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpWorkflowAssigneeLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IWorkflowAssigneeLookup
{
    public Task<IReadOnlyList<string>> GetOpenAssigneeIdsForPropertyAsync(
        Guid propertyId,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default) =>
        GetAsync($"propertyId={propertyId:D}", taskKinds, cancellationToken);

    public Task<IReadOnlyList<string>> GetOpenAssigneeIdsForPoAsync(
        string poNumber,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default) =>
        GetAsync($"poNumber={Uri.EscapeDataString(poNumber.Trim())}", taskKinds, cancellationToken);

    private async Task<IReadOnlyList<string>> GetAsync(
        string scope,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken)
    {
        var kinds = string.Join(",", taskKinds.Select(k => k.ToString()));
        var body = await UpstreamJson.GetAsync<WorkflowAssigneeIdsDto>(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            $"/api/workflow-assignees?{scope}&kinds={Uri.EscapeDataString(kinds)}",
            "UpstreamServices:CaseStudyBaseUrl",
            cancellationToken);
        return body.AssigneeIds;
    }
}
