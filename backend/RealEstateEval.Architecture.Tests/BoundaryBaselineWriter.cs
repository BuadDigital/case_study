using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Regenerates docs/architecture/boundary-baseline.json when explicitly asked:
/// <c>REE_ARCH_BASELINE=update dotnet test backend/RealEstateEval.Architecture.Tests</c>.
/// The regenerated file must be reviewed like any other architecture change; growth in it is
/// exactly what the other tests are meant to stop.
/// </summary>
public class BoundaryBaselineWriter
{
    [Fact]
    public void WriteBaselineWhenRequested()
    {
        if (!BoundaryBaseline.UpdateRequested)
        {
            Assert.True(
                File.Exists(BoundaryBaseline.Path),
                $"Missing {RepoPaths.Relative(BoundaryBaseline.Path)}. Regenerate with "
                + $"{BoundaryBaseline.UpdateEnvironmentVariable}=update dotnet test.");
            return;
        }

        BoundaryBaseline.Current().Save();
    }
}
