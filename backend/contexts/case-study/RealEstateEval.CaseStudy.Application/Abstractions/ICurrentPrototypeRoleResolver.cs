namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Prototype role of the user behind the current request, or null when there is no
/// authenticated user. Keeps HTTP / permission plumbing out of the Application use cases.
/// </summary>
public interface ICurrentPrototypeRoleResolver
{
    Task<string?> ResolveAsync(CancellationToken cancellationToken);
}
