namespace RealEstateEval.Domain;

public class CustomAssignedScreenUser
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public CustomAssignedScreen Screen { get; set; } = null!;
    public string UserId { get; set; } = "";
    public DateTime AssignedAtUtc { get; set; }
}
