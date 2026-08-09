using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class WorkOrderMapperTests
{
    [Fact]
    public void ToPriorDeedDto_preserves_court_circuit_region_and_property_id()
    {
        var courtId = Guid.NewGuid();
        var circuitId = Guid.NewGuid();
        var regionId = Guid.NewGuid();
        var cityId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var property = new WorkOrderProperty
        {
            Id = propertyId,
            Court = "المحكمة العامة",
            Circuit = "الدائرة الأولى",
            CourtId = courtId,
            CircuitId = circuitId,
            Region = "الرياض",
            RegionId = regionId,
            City = "الرياض",
            CityId = cityId,
        };

        var dto = WorkOrderMapper.ToPriorDeedDto(property, "PO-1");

        Assert.Equal(courtId, dto.CourtId);
        Assert.Equal(circuitId, dto.CircuitId);
        Assert.Equal(regionId, dto.RegionId);
        Assert.Equal(cityId, dto.CityId);
        Assert.Equal("الرياض", dto.Region);
        Assert.Equal(propertyId, dto.PropertyId);
    }
}
