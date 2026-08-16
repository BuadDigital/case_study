using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class ClientDto
{
    public Guid Id { get; set; }
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
    public string? IdentityNumber { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedAtUtc { get; set; } = "";
    public string UpdatedAtUtc { get; set; } = "";
}

public class UpsertClientRequest
{
    [Required, MaxLength(256)]
    public string NameAr { get; set; } = "";

    [MaxLength(256)]
    public string? NameEn { get; set; }

    [MaxLength(64)]
    public string? IdentityNumber { get; set; }

    [MaxLength(32)]
    public string? Phone { get; set; }

    [MaxLength(256)]
    public string? Email { get; set; }

    public bool IsActive { get; set; } = true;
}
