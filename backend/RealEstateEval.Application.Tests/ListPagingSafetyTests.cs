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
    public void Extreme_page_number_does_not_overflow_to_negative_skip()
    {
        var options = new DatabaseOptions();

        var (skip, _, _, _) =
            NpgsqlConfiguration.ResolveListPaging(int.MaxValue, 500, options);

        Assert.Equal(int.MaxValue, skip);
    }
}
