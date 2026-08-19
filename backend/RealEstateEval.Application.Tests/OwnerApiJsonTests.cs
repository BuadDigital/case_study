using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class OwnerApiJsonTests
{
    [Fact]
    public void Reads_identity_compensation_with_string_enums()
    {
        const string json =
            """{"assigneeId":"insp-1","userId":"u-1","hasCompensation":true,"contractType":"Internal","providerKind":null,"employmentType":"employee"}""";

        var dto = JsonSerializer.Deserialize<IdentityCompensationProfileDto>(json, OwnerApiJson.Options);

        Assert.NotNull(dto);
        Assert.Equal("insp-1", dto.AssigneeId);
        Assert.True(dto.HasCompensation);
        Assert.Equal(ContractType.Internal, dto.ContractType);
        Assert.Null(dto.ProviderKind);
        Assert.Equal("employee", dto.EmploymentType);
    }

    [Fact]
    public void Reads_identity_compensation_with_numeric_enums()
    {
        const string json =
            """{"assigneeId":"insp-2","userId":"u-2","hasCompensation":true,"contractType":1,"providerKind":0}""";

        var dto = JsonSerializer.Deserialize<IdentityCompensationProfileDto>(json, OwnerApiJson.Options);

        Assert.NotNull(dto);
        Assert.Equal(ContractType.Freelance, dto.ContractType);
        Assert.Equal(ProcProviderKind.Individual, dto.ProviderKind);
    }
}
