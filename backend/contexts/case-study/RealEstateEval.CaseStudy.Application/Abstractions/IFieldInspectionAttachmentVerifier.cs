using System.Text.Json;

namespace RealEstateEval.Application.Abstractions;

public interface IFieldInspectionAttachmentVerifier
{
    Task<Dictionary<string, string>> VerifyAsync(
        Guid workflowTaskId,
        JsonElement payload,
        CancellationToken cancellationToken = default);
}
