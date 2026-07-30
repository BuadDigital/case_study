namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// Container tests need a Docker daemon. CI always has one; a workstation may not, and a
/// missing daemon must skip these tests rather than fail the suite.
/// Force either way with <c>REAL_ESTATE_EVAL_CONTAINER_TESTS=1</c> / <c>=0</c>.
/// </summary>
public static class DockerEnvironment
{
    public const string SkipReason =
        "Docker is not available (set REAL_ESTATE_EVAL_CONTAINER_TESTS=1 to force).";

    private static readonly Lazy<bool> Probed = new(Probe);

    public static bool IsAvailable => Probed.Value;

    private static bool Probe()
    {
        var flag = Environment.GetEnvironmentVariable("REAL_ESTATE_EVAL_CONTAINER_TESTS");
        if (flag is not null)
            return flag is "1" || string.Equals(flag, "true", StringComparison.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("DOCKER_HOST")))
            return true;

        return OperatingSystem.IsWindows()
            ? File.Exists(@"\\.\pipe\docker_engine")
            : File.Exists("/var/run/docker.sock");
    }
}

/// <summary>A <see cref="FactAttribute"/> that skips itself when Docker is unavailable.</summary>
public sealed class DockerFactAttribute : FactAttribute
{
    public DockerFactAttribute()
    {
        if (!DockerEnvironment.IsAvailable)
            Skip = DockerEnvironment.SkipReason;
    }
}
