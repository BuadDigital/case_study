using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Platform.Infrastructure.Services;

/// <summary>
/// Report gaps in organization settings go to the last person who changed that settings section
/// (audit trail); a section never saved by a person falls back to the settings-page role.
/// </summary>
public sealed class OrganizationSettingsGapService(
    PlatformDbContext db,
    IIdentityDirectory identity,
    INotificationService notifications) : IOrganizationSettingsGapService
{
    public async Task<OrganizationSettingsSectionEditorsDto> GetSectionEditorsAsync(
        CancellationToken cancellationToken)
    {
        var editors = await ResolveEditorsAsync(cancellationToken);
        return new OrganizationSettingsSectionEditorsDto
        {
            Company = editors["company"].ToDto(),
            Evaluator = editors["evaluator"].ToDto(),
            Report = editors["report"].ToDto(),
        };
    }

    public async Task<(int NotifiedCount, string RecipientName, string? Error)> NotifyAsync(
        NotifyOrganizationSettingsGapRequest request,
        string? actorDisplayName,
        CancellationToken cancellationToken)
    {
        var section = OrganizationSettingsGapRules.NormalizeSection(request.Section);
        if (section is null) return (0, "", "قسم الإعدادات غير معروف.");

        var label = (request.FieldLabel ?? "").Trim();
        if (label.Length == 0) return (0, "", "اسم الحقل مطلوب.");
        if (label.Length > 120) label = label[..120];

        var editor = (await ResolveEditorsAsync(cancellationToken))[section];
        if (editor.UserIds.Count == 0)
            return (0, "", "لا يوجد مسؤول عن إعدادات المنشأة يمكن إشعاره.");

        var fieldKey = string.IsNullOrWhiteSpace(request.FieldKey) ? label : request.FieldKey.Trim();
        var po = (request.PoNumber ?? "").Trim();
        var actor = string.IsNullOrWhiteSpace(actorDisplayName) ? "المقيّم" : actorDisplayName.Trim();

        await notifications.CreateForUsersAsync(
            editor.UserIds,
            new CreateUserNotificationRequest
            {
                Title = "نقص في إعدادات المنشأة",
                Body =
                    $"«{label}» فارغ في «{OrganizationSettingsGapRules.SectionLabel(section)}» ويظهر ناقصاً في تقرير التقييم{(po.Length > 0 ? $" — أمر العمل {po}" : "")}. طلب الاستكمال من {actor}.",
                Tone = NotificationContract.Tones.Warn,
                Href = $"/organization-settings?tab={section}",
                Category = NotificationContract.Categories.System,
                Actor = actor,
                SourceEvent = $"org-field-gap:{section}:{fieldKey}",
            },
            cancellationToken);

        return (editor.UserIds.Count, editor.Name, null);
    }

    private async Task<Dictionary<string, Editor>> ResolveEditorsAsync(CancellationToken cancellationToken)
    {
        var rows = await db.AuditLogs
            .AsNoTracking()
            .Where(row => row.Action == OrganizationSettingsGapRules.SavedAction
                && row.EntityType == OrganizationSettingsGapRules.AuditEntityType)
            .OrderByDescending(row => row.CreatedAtUtc)
            .Take(OrganizationSettingsGapRules.HistoryWindow)
            .ToListAsync(cancellationToken);

        var last = OrganizationSettingsGapRules.Sections.ToDictionary(
            section => section,
            section => OrganizationSettingsGapRules.LastEditor(rows, section));
        var actorIds = last.Values
            .Where(row => row is not null)
            .Select(row => row!.ActorId)
            .Distinct()
            .ToList();
        var names = actorIds.Count > 0
            ? await identity.ResolveDisplayNamesByUserIdsAsync(actorIds, cancellationToken)
            : new Dictionary<string, string>();

        IReadOnlyList<string>? fallback = null;
        var editors = new Dictionary<string, Editor>();
        foreach (var (section, row) in last)
        {
            if (row is not null)
            {
                var name = names.TryGetValue(row.ActorId, out var found) && !string.IsNullOrWhiteSpace(found)
                    ? found.Trim()
                    : "آخر من عدّل الإعدادات";
                editors[section] = new Editor(name, [row.ActorId], row.CreatedAtUtc);
                continue;
            }

            fallback ??= await identity.ResolveUserIdsWithPrototypeRoleAsync(
                OrganizationSettingsGapRules.FallbackRole,
                cancellationToken);
            editors[section] = new Editor("مسؤول إعدادات المنشأة", fallback, null);
        }

        return editors;
    }

    private sealed record Editor(string Name, IReadOnlyList<string> UserIds, DateTime? EditedAtUtc)
    {
        public OrganizationSettingsSectionEditorDto ToDto() => new()
        {
            Name = Name,
            CanNotify = UserIds.Count > 0,
            EditedAtUtc = EditedAtUtc,
        };
    }
}
