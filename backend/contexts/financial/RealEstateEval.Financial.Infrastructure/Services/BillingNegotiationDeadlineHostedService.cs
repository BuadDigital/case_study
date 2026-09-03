using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// E6 — Reminders and escalation of negotiation timeout on contested Pricing Quote (bit lines 9–14).
/// The scan only reads live values: the time limit expires when an “objector” exits or the opponent changes
/// It eliminates pending reminders — no off-the-book status.
/// </summary>
public sealed class BillingNegotiationDeadlineHostedService : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(10);

    private const string AuditAction = "BILLING_NEGOTIATION_DEADLINE";
    private const string AuditEntityType = "inspector_fee_ledger";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BillingNegotiationDeadlineHostedService> _logger;
    private readonly TimeProvider _time;

    public BillingNegotiationDeadlineHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<BillingNegotiationDeadlineHostedService> logger,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(InitialDelay, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                await SweepAsync(scope.ServiceProvider, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Billing negotiation deadline sweep failed");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private async Task SweepAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var financial = services.GetRequiredService<FinancialDbContext>();
        var notifications = services.GetRequiredService<INotificationService>();
        var recipients = services.GetRequiredService<NotificationRecipientResolver>();
        var audit = services.GetRequiredService<IAuditLogWriter>();
        var opsTasks = services.GetService<IOperationsTaskService>();

        var now = _time.UtcNow();
        var ledgers = await financial.InspectorFeeLedgers
            .Where(x =>
                x.BillingStatus == InspectorFeeBillingStatus.Disputed
                && x.DisputeDeadlineUtc != null)
            .ToListAsync(cancellationToken);
        if (ledgers.Count == 0) return;

        var supervisors = await recipients.ResolveUserIdsWithPrototypeRoleAsync(
            StaffRoleIds.SectionSupervisor, cancellationToken);
        var financeOfficers = await recipients.ResolveUserIdsWithPrototypeRoleAsync(
            StaffRoleIds.FinancialOfficer, cancellationToken);

        var officeAssignees = ledgers
            .Select(l => l.AssigneeId?.Trim())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Cast<string>()
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var officeUsersByAssignee = await recipients.ResolveUserIdsForDistributionAssigneesAsync(
            officeAssignees, cancellationToken);

        var anyChanged = false;
        foreach (var ledger in ledgers)
        {
            var deadline = ledger.DisputeDeadlineUtc!.Value;
            var dueStages = BillingNegotiationDeadlines.DueStages(
                deadline, now, ledger.DisputeNotifiedStages);

            foreach (var stage in dueStages)
            {
                await NotifyStageAsync(
                    notifications,
                    opsTasks,
                    ledger,
                    stage,
                    deadline,
                    supervisors,
                    financeOfficers,
                    officeUsersByAssignee,
                    cancellationToken);

 // The wording of Decision Clause 14 is under scrutiny.
                financial.AuditLogs.Add(audit.Create(
                    "system:billing-negotiation",
                    AuditAction,
                    AuditEntityType,
                    ledger.Id.ToString(),
                    null,
                    new
                    {
                        summary =
                            $"مهلة تفاوض التسعيرة: {stage} — بند {ledger.PoNumber}"
                            + $" — الانقضاء {deadline:O}",
                        stage,
                        deadlineUtc = deadline,
                        workflowTaskId = ledger.WorkflowTaskId,
                    }));

                ledger.DisputeNotifiedStages = BillingNegotiationDeadlines
                    .AppendNotifiedStage(ledger.DisputeNotifiedStages, stage);
                ledger.UpdatedAtUtc = now;
                anyChanged = true;
            }
        }

        if (anyChanged)
            await financial.SaveChangesAsync(cancellationToken);
    }

    private static async Task NotifyStageAsync(
        INotificationService notifications,
        IOperationsTaskService? opsTasks,
        InspectorFeeLedger ledger,
        string stage,
        DateTime deadlineUtc,
        IReadOnlyList<string> supervisors,
        IReadOnlyList<string> financeOfficers,
        IReadOnlyDictionary<string, string> officeUsersByAssignee,
        CancellationToken cancellationToken)
    {
        var sourceEvent = BillingNegotiationDeadlines.SourceEventKey(
            ledger.Id, stage, deadlineUtc);
        var isEscalation = stage == BillingNegotiationDeadlines.StageEscalation;

 // Clause 11: The two reminders to the relevant office + the department supervisor; Escalation to CFO and supervisor copy.
        var recipients = new List<string>();
        if (isEscalation)
        {
            recipients.AddRange(financeOfficers);
            recipients.AddRange(supervisors);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(ledger.AssigneeId)
                && officeUsersByAssignee.TryGetValue(ledger.AssigneeId.Trim(), out var officeUser))
            {
                recipients.Add(officeUser);
            }
            recipients.AddRange(supervisors);
        }
        var userIds = recipients
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (userIds.Count > 0)
        {
            var title = isEscalation
                ? "انقضت مهلة التفاوض على التسعيرة"
                : "تذكير بمهلة التفاوض على التسعيرة";
            var deadlineRiyadh = deadlineUtc.AddHours(3);
            var body = isEscalation
                ? $"بند أمر العمل {ledger.PoNumber} ما زال معترَضاً بعد انقضاء المهلة"
                  + $" ({deadlineRiyadh:yyyy-MM-dd HH:mm} بتوقيت الرياض) — يلزم حسم الخلاف."
                : $"بند أمر العمل {ledger.PoNumber} معترَض والمهلة تنقضي"
                  + $" {deadlineRiyadh:yyyy-MM-dd HH:mm} بتوقيت الرياض.";

            await notifications.CreateForUsersAsync(
                userIds,
                new CreateUserNotificationRequest
                {
                    Title = title,
                    Body = body,
                    Tone = isEscalation ? "warning" : "info",
                    Href = "/party-fees",
                    Category = "financial",
                    EntityType = "task",
                    EntityId = ledger.WorkflowTaskId.ToString(),
                    SourceEvent = sourceEvent,
                },
                cancellationToken);
        }

 // Clause 13: Automated operations task upon expiration — No automatic state transition. Assigned to a desk
 // Conflict (Operations Task Forces Vocabulary) is the implementation party - the supervisor reaches the escalation
 // notice and it will be deducted from the fees screen).
        if (isEscalation
            && opsTasks is not null
            && !string.IsNullOrWhiteSpace(ledger.AssigneeId)
            && !string.IsNullOrWhiteSpace(ledger.PoNumber))
        {
            await opsTasks.CreateAsync(
                new CreateOperationsTaskRequest
                {
 // Task type/scope literals (OperationsTask{Type,Scope}Values) — no project reference
 // To Operations.Domain from here (boundary A8).
                    Type = "general",
                    Title = "حسم خلاف تسعيرة منقضي المهلة",
                    Description =
                        $"انقضت مهلة التفاوض على بند أمر العمل {ledger.PoNumber}"
                        + $" ({deadlineUtc.AddHours(3):yyyy-MM-dd HH:mm} بتوقيت الرياض)."
                        + " أنهِ التفاوض أو ارفع الخلاف للمشرف لحسمه.",
                    Scope = "work_order",
                    PoNumber = ledger.PoNumber.Trim(),
                    AssigneeId = ledger.AssigneeId.Trim(),
                    Priority = "high",
                },
                createdBy: "system:billing-negotiation",
                createdByName: "مهلة التفاوض الآلية",
                cancellationToken);
        }
    }
}
