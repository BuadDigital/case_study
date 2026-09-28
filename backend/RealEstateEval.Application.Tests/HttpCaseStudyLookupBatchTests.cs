using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class HttpCaseStudyLookupBatchTests
{
    [Fact]
    public async Task Workflow_task_kinds_for_500_ids_use_four_gets_under_the_request_line_cap()
    {
        var ids = Enumerable.Range(0, 500).Select(_ => Guid.NewGuid()).ToList();
        ids.Add(ids[0]);
        var handler = new RecordingHandler();
        using var http = new HttpClient(handler);
        var lookup = new HttpCaseStudyLookup(
            http,
            new NullHttpContextAccessor(),
            Options.Create(new UpstreamServicesOptions
            {
                CaseStudyBaseUrl = "http://case-study.test",
            }));

        var map = await lookup.GetWorkflowTaskKindsAsync(ids);

        Assert.Equal(4, handler.Uris.Count);
        Assert.Equal(500, map.Count);
        foreach (var id in ids)
            Assert.Equal(RealEstateEval.Domain.WorkflowTaskKind.FieldInspection, map[id]);

        foreach (var uri in handler.Uris)
        {
            Assert.True(
                Encoding.UTF8.GetByteCount(uri.AbsoluteUri) < QueryIdBatch.MaxRequestLineBytes);
            var query = Uri.UnescapeDataString(uri.Query.TrimStart('?'));
            var prefix = "ids=";
            Assert.StartsWith(prefix, query, StringComparison.Ordinal);
            var chunk = query[prefix.Length..].Split(',', StringSplitOptions.RemoveEmptyEntries);
            Assert.InRange(chunk.Length, 1, QueryIdBatch.MaxPerGet);
        }

        var requested = handler.Uris
            .SelectMany(uri =>
            {
                var query = Uri.UnescapeDataString(uri.Query.TrimStart('?'));
                return query["ids=".Length..].Split(',', StringSplitOptions.RemoveEmptyEntries);
            })
            .Select(Guid.Parse)
            .ToList();
        Assert.Equal(500, requested.Count);
        Assert.Equal(ids.Distinct().OrderBy(id => id), requested.OrderBy(id => id));
    }

    [Fact]
    public async Task Empty_id_list_does_not_call_the_upstream()
    {
        var handler = new RecordingHandler();
        using var http = new HttpClient(handler);
        var lookup = new HttpCaseStudyLookup(
            http,
            new NullHttpContextAccessor(),
            Options.Create(new UpstreamServicesOptions
            {
                CaseStudyBaseUrl = "http://case-study.test",
            }));

        var map = await lookup.GetWorkflowTaskKindsAsync([]);

        Assert.Empty(map);
        Assert.Empty(handler.Uris);
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public List<Uri> Uris { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var uri = request.RequestUri ?? throw new InvalidOperationException("missing uri");
            Uris.Add(uri);

            var query = Uri.UnescapeDataString(uri.Query.TrimStart('?'));
            var ids = query.StartsWith("ids=", StringComparison.Ordinal)
                ? query["ids=".Length..].Split(',', StringSplitOptions.RemoveEmptyEntries)
                : [];
            var payload = ids.Select(id => new { id, kind = "FieldInspection" }).ToArray();
            var json = JsonSerializer.Serialize(payload);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            });
        }
    }

    private sealed class NullHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; }
    }
}
