namespace RealEstateEval.Application.Contracts;

public class CourtDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Region { get; set; } = "";
    public string City { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public int CircuitsCount { get; set; }
    public string CreatedBy { get; set; } = "";
    public string CreatedAtUtc { get; set; } = "";
    public string? UpdatedBy { get; set; }
    public string? UpdatedAtUtc { get; set; }
}

public class CourtCircuitDto
{
    public Guid Id { get; set; }
    public Guid CourtId { get; set; }
    public string CircuitNo { get; set; } = "";
    public string? CircuitName { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = "";
    public string CreatedAtUtc { get; set; } = "";
    public string? UpdatedBy { get; set; }
    public string? UpdatedAtUtc { get; set; }
}

public class CourtDetailDto : CourtDto
{
    public List<CourtCircuitDto> Circuits { get; set; } = [];
}

public class CourtListResponseDto
{
    public List<CourtDto> Data { get; set; } = [];
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}

public class CreateCourtRequest
{
    public string Name { get; set; } = "";
    public string Region { get; set; } = "";
    public string City { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public class UpdateCourtRequest
{
    public string? Name { get; set; }
    public string? Region { get; set; }
    public string? City { get; set; }
    public bool? IsActive { get; set; }
}

public class SetActiveStatusRequest
{
    public bool IsActive { get; set; }
}

public class CreateCourtCircuitRequest
{
    public string CircuitNo { get; set; } = "";
    public string? CircuitName { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateCourtCircuitRequest
{
    public string? CircuitNo { get; set; }
    public string? CircuitName { get; set; }
    public bool? IsActive { get; set; }
}

public class SelectableCourtDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Region { get; set; } = "";
    public string City { get; set; } = "";
}

public class SelectableCircuitDto
{
    public Guid Id { get; set; }
    public Guid CourtId { get; set; }
    public string CircuitNo { get; set; } = "";
    public string? CircuitName { get; set; }
}
