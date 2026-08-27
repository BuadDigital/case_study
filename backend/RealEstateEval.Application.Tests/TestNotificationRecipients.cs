using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A8 hard-stay unwind: the EF-backed recipient-resolver wiring lives with the tests —
/// production DI uses the interface constructor only.
/// </summary>
internal static class TestNotificationRecipients
{
    public static NotificationRecipientResolver ForContexts(
        CaseStudyDbContext caseStudy,
        IdentityDbContext identity) =>
        new(new WorkflowAssigneeLookup(caseStudy), new IdentityDirectory(identity));
}
