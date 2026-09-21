using System.Text.Json;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Platform.Domain;
using RealEstateEval.Platform.Infrastructure.Data;
using RealEstateEval.Platform.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class ValuationGlossaryListTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private static Task<IReadOnlyList<ValuationListItemDto>> GlossaryAsync(
        IReadOnlyList<ValuationListItemDto>? stored) =>
        ListAsync(ValuationListIds.Glossary, stored);

    private static async Task<IReadOnlyList<ValuationListItemDto>> ListAsync(
        string listId,
        IReadOnlyList<ValuationListItemDto>? stored)
    {
        await using var db = TestDatabases.Platform($"glossary-list-{Guid.NewGuid():N}");
        if (stored is not null)
        {
            db.AttachmentPrintDictionaryConfigs.Add(new AttachmentPrintDictionaryConfig
            {
                Id = AttachmentPrintDictionarySeed.SingletonId,
                CatalogJson = JsonSerializer.Serialize(
                    new { lists = new Dictionary<string, object> { [listId] = stored } },
                    Web),
                UpdatedAtUtc = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        IValuationListsService service = new AttachmentPrintDictionaryService(db);
        var lists = await service.GetAsync();
        return lists.Lists[listId];
    }

    [Fact]
    public async Task A_fresh_catalog_carries_the_reference_glossary_in_its_order()
    {
        var rows = await GlossaryAsync(null);

        Assert.Equal(42, rows.Count);
        Assert.Equal("org", rows[0].Key);
        Assert.Equal("المنشأة", rows[0].Name);
        Assert.Equal("rfp", rows[^1].Key);
        Assert.Equal("طلب العروض", rows[^1].Name);
        Assert.Equal(rows.Count, rows.Select(r => r.Key).Distinct().Count());
        Assert.All(rows, r => Assert.False(string.IsNullOrWhiteSpace(r.Cells[0])));
        Assert.DoesNotContain(rows, r => r.Key is "judgment" or "skepticism" or "specialist" or "liq_value");
    }

    [Fact]
    public async Task An_untouched_stored_copy_of_the_previous_glossary_moves_to_the_reference_one()
    {
        var rows = await GlossaryAsync(ValuationListsSeed.PreviousGlossary());

        Assert.Equal(42, rows.Count);
        Assert.Equal("المنشأة", rows[0].Name);
        Assert.DoesNotContain(rows, r => r.Key == "judgment");
    }

    [Fact]
    public async Task A_disabled_row_means_the_list_was_edited_and_is_kept()
    {
        var previous = ValuationListsSeed.PreviousGlossary();
        previous[3] = Copy(previous[3], isEnabled: false);

        var rows = await GlossaryAsync(previous);

        Assert.Equal(previous.Count, rows.Count);
        Assert.Contains(rows, r => r.Key == "judgment");
        Assert.False(rows[3].IsEnabled);
    }

    [Fact]
    public async Task An_edited_definition_keeps_the_stored_list()
    {
        var previous = ValuationListsSeed.PreviousGlossary();
        previous[0] = Copy(previous[0], cells: ["تعريف المؤسسة المعدّل."]);

        var rows = await GlossaryAsync(previous);

        Assert.Equal(previous.Count, rows.Count);
        Assert.Equal("تعريف المؤسسة المعدّل.", rows[0].Cells[0]);
    }

    [Fact]
    public async Task A_fresh_catalog_carries_the_reference_ivs_standards()
    {
        var rows = await ListAsync(ValuationListIds.IvsStandards, null);

        Assert.Equal(7, rows.Count);
        Assert.Equal(["ivs_100", "ivs_101", "ivs_102", "ivs_103", "ivs_104", "ivs_105", "ivs_106"], rows.Select(r => r.Key));
        Assert.Contains("مبادئ المُقيّم", rows[0].Cells[0]);
        Assert.Contains("(AVM)", rows[5].Cells[0]);
    }

    [Fact]
    public async Task An_untouched_stored_copy_of_the_previous_ivs_list_moves_to_the_reference_one()
    {
        var rows = await ListAsync(ValuationListIds.IvsStandards, ValuationListsSeed.PreviousIvsStandards());

        Assert.Contains("مبادئ المُقيّم", rows[0].Cells[0]);
    }

    [Fact]
    public async Task An_edited_ivs_definition_keeps_the_stored_list()
    {
        var previous = ValuationListsSeed.PreviousIvsStandards();
        previous[1] = Copy(previous[1], cells: ["تعريف معدّل."]);

        var rows = await ListAsync(ValuationListIds.IvsStandards, previous);

        Assert.Equal("تعريف معدّل.", rows[1].Cells[0]);
        Assert.DoesNotContain("مبادئ المُقيّم", rows[0].Cells[0]);
    }

    private static ValuationListItemDto Copy(
        ValuationListItemDto row,
        bool? isEnabled = null,
        string[]? cells = null) => new()
    {
        Id = row.Id,
        Key = row.Key,
        Name = row.Name,
        Cells = cells ?? row.Cells,
        IsEnabled = isEnabled ?? row.IsEnabled,
        DefaultName = row.DefaultName,
        Usage = row.Usage,
        SortOrder = row.SortOrder,
        IsSystemDefault = row.IsSystemDefault,
    };
}
