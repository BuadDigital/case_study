using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class BuildingInventoryLineDto
{
    public Guid? Id { get; set; }
    public int SortOrder { get; set; }
    /// <summary>floor | fence | annex | basement | other</summary>
    public string StructureKind { get; set; } = "floor";
    public string Label { get; set; } = "";
    public string? AreaSqm { get; set; }
    public string? Notes { get; set; }
}

public class BuildingInventoryDto
{
    public Guid PropertyId { get; set; }
    /// <summary>empty | yes | no</summary>
    public string HasStructuresToValue { get; set; } = "";
    public List<BuildingInventoryLineDto> Lines { get; set; } = [];
}

public class SaveBuildingInventoryRequest
{
    /// <summary>empty | yes | no</summary>
    [Required]
    public string HasStructuresToValue { get; set; } = "";

    public List<BuildingInventoryLineDto> Lines { get; set; } = [];
}
