using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class BuildingInventoryRulesTests
{
    [Theory]
    [InlineData("floor", true)]
    [InlineData("fence", true)]
    [InlineData("annex", true)]
    [InlineData("basement", true)]
    [InlineData("other", true)]
    [InlineData("wall", false)]
    [InlineData("", false)]
    public void StructureKind_known_values(string kind, bool known)
    {
        Assert.Equal(known, BuildingStructureKinds.IsKnown(kind));
    }

    [Theory]
    [InlineData("", true)]
    [InlineData("yes", true)]
    [InlineData("no", true)]
    [InlineData("maybe", false)]
    public void HasStructures_known_values(string value, bool known)
    {
        Assert.Equal(known, HasStructuresToValueValues.IsKnown(value));
    }
}
