using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Infrastructure;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Round 2: a cross-service read (hand-over gates, the final value, the assigned appraiser) waits at
/// most <see cref="RemoteClientRegistration.LookupTimeout"/> — not the framework's 100 s — so the
/// caller answers «تعذّر التحقق … أعد المحاولة» while the user is still there.
/// </summary>
public class RemoteClientTimeoutTests
{
    [Theory]
    [InlineData("IValuationRequestService")]
    [InlineData("IValuationRequestFolding")]
    [InlineData("IValuationReportReopenCommands")]
    [InlineData("ICaseStudyLookup")]
    [InlineData("IWorkflowAssigneeLookup")]
    public void Lookup_clients_time_out_after_ten_seconds(string clientName)
    {
        var configuration = new ConfigurationBuilder().Build();
        var services = new ServiceCollection();
        services.AddRemoteValuationRequests(configuration);
        services.AddRemoteCaseStudy(configuration);
        using var provider = services.BuildServiceProvider();

        var client = provider.GetRequiredService<IHttpClientFactory>().CreateClient(clientName);

        Assert.Equal(TimeSpan.FromSeconds(10), client.Timeout);
    }
}
