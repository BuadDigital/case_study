using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// The appraiser hands a transaction on without reassigning it himself (Omar 2026-11-18): he asks whoever
/// handed it to him, or transfers it to a colleague who accepts. Errors are Arabic, keyed «_».
/// </summary>
public interface IAppraiserHandoverService
{
    Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> RequestReassignmentAsync(
        RequestAppraiserReassignmentRequest request, PartySubmissionActor actor, CancellationToken cancellationToken = default);

    Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> RequestPeerTransferAsync(
        RequestPeerTransferRequest request, PartySubmissionActor actor, CancellationToken cancellationToken = default);

    Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> TakeAsync(
        Guid id, PartySubmissionActor actor, CancellationToken cancellationToken = default);

    Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> CompleteReassignmentAsync(
        Guid id, CompleteAppraiserReassignmentRequest request, PartySubmissionActor actor, CancellationToken cancellationToken = default);

    Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> AcceptPeerAsync(
        Guid id, PartySubmissionActor actor, CancellationToken cancellationToken = default);

    Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> DeclinePeerAsync(
        Guid id, CloseAppraiserHandoverRequest request, PartySubmissionActor actor, CancellationToken cancellationToken = default);

    Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> CancelAsync(
        Guid id, CloseAppraiserHandoverRequest request, PartySubmissionActor actor, CancellationToken cancellationToken = default);

    /// <summary>The open requests the caller sees: an appraiser his own and those waiting for him; staff those they may handle.</summary>
    Task<IReadOnlyList<AppraiserHandoverRequestDto>> ListOpenAsync(
        PartySubmissionActor actor, CancellationToken cancellationToken = default);

    /// <summary>The sweep: widens untaken requests to the team after the head start, and sends the end-of-day reminder.</summary>
    Task SweepAsync(CancellationToken cancellationToken = default);
}
