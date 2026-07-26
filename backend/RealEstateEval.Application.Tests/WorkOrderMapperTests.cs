using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class WorkOrderMapperTests
{
    [Fact]
    public void ToPriorDeedDto_preserves_court_and_circuit_ids()
    {
        var courtId = Guid.NewGuid();
        var circuitId = Guid.NewGuid();
        var property = new WorkOrderProperty
        {
            Court = "المحكمة العامة",
            Circuit = "الدائرة الأولى",
            CourtId = courtId,
            CircuitId = circuitId,
        };

        var dto = WorkOrderMapper.ToPriorDeedDto(property, "PO-1");

        Assert.Equal(courtId, dto.CourtId);
        Assert.Equal(circuitId, dto.CircuitId);
    }
}
