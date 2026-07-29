using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Api.IntegrationTests;

public class ClientAddressResolverTests
{
    [Fact]
    public void Ingress_supplied_address_wins_over_forwarded_for()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Real-IP"] = "203.0.113.5";
        context.Request.Headers["X-Forwarded-For"] = "198.51.100.9, 172.18.0.4";
        context.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.3");

        Assert.Equal("203.0.113.5", Resolve(context));
    }

    [Fact]
    public void Forwarded_for_falls_back_to_the_closest_proxy_view()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Forwarded-For"] = "10.1.1.1, 203.0.113.5";
        context.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.3");

        Assert.Equal("203.0.113.5", Resolve(context));
    }

    [Fact]
    public void Socket_peer_is_used_for_direct_callers()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.77");

        Assert.Equal("203.0.113.77", Resolve(context));
    }

    [Fact]
    public void Forwarded_for_can_be_distrusted()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.5";
        context.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.3");

        var options = Options(new Dictionary<string, string?>
        {
            ["RateLimiting:TrustForwardedForHeader"] = "false",
        });

        Assert.Equal("172.18.0.3", ClientAddressResolver.Resolve(context, options));
    }

    [Theory]
    [InlineData("203.0.113.5:41234", "203.0.113.5")]
    [InlineData("[2001:db8::1]:41234", "2001:db8::1")]
    [InlineData("::ffff:203.0.113.5", "203.0.113.5")]
    public void Proxy_address_forms_are_normalized(string forwarded, string expected)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Forwarded-For"] = forwarded;

        Assert.Equal(expected, Resolve(context));
    }

    [Fact]
    public void Unresolvable_callers_return_null()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Real-IP"] = "not-an-address";

        Assert.Null(Resolve(context));
    }

    private static string? Resolve(HttpContext context) =>
        ClientAddressResolver.Resolve(context, Options(new Dictionary<string, string?>()));

    private static RateLimitingOptions Options(Dictionary<string, string?> values) =>
        RateLimitingOptions.FromConfiguration(
            new ConfigurationBuilder().AddInMemoryCollection(values).Build(),
            new TestHostEnvironment(Environments.Production));
}
