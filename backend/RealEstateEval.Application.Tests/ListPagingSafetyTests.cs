using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

public class ListPagingSafetyTests
{
    [Fact]
    public void Defaults_cap_unpaginated_lists()
    {
        var options = new DatabaseOptions();

        var (_, take, page, isPaged) =
            NpgsqlConfiguration.ResolveListPaging(null, null, options);

        Assert.Equal(500, take);
        Assert.Equal(1, page);
        Assert.False(isPaged);
    }

    [Fact]
    public void Requested_page_size_is_clamped_to_maximum()
    {
        var options = new DatabaseOptions();

        var (skip, take, page, isPaged) =
            NpgsqlConfiguration.ResolveListPaging(3, 50_000, options);

        Assert.Equal(1000, skip);
        Assert.Equal(500, take);
        Assert.Equal(3, page);
        Assert.True(isPaged);
    }

    [Fact]
    public void Missing_page_size_uses_safe_default()
    {
        var options = new DatabaseOptions();

        var (_, take, _, _) =
            NpgsqlConfiguration.ResolveListPaging(1, null, options);

        Assert.Equal(100, take);
    }

    [Fact]
    public void Zero_unpaginated_cap_is_rejected_outside_development()
    {
        var builder = Host.CreateApplicationBuilder();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            [$"{DatabaseOptions.SectionName}:{nameof(DatabaseOptions.UnpaginatedListCap)}"] = "0",
        });
        builder.Environment.EnvironmentName = Environments.Production;
        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);

        var ex = Assert.Throws<OptionsValidationException>(() => builder.Build().Start());
        Assert.Contains("UnpaginatedListCap", ex.Message, StringComparison.Ordinal);
    }
}
