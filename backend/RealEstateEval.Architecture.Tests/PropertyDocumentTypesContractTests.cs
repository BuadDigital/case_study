using System.Text.Json;
using RealEstateEval.Architecture.Tests.Support;
using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// The property document registry exists twice — backend <see cref="PropertyDocumentTypes"/> and
/// the frontend mirror in packages/app-shared. Both are pinned to
/// docs/architecture/property-document-types.json so a type cannot be added on one side only.
/// </summary>
public sealed class PropertyDocumentTypesContractTests
{
    private static readonly string ContractPath =
        Path.Combine(RepoPaths.ArchitectureDocs, "property-document-types.json");

    [Fact]
    public void BackendRegistryMatchesTheSharedContract()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(ContractPath));
        var root = doc.RootElement;

        Assert.Equal(PropertyDocumentTypes.GovernedScope, root.GetProperty("governedScope").GetString());
        Assert.Equal(PropertyDocumentTypes.UnlistedKey, root.GetProperty("unlistedKey").GetString());
        Assert.Equal(PropertyDocumentReviewStatuses.All, Strings(root.GetProperty("reviewStatuses")));
        Assert.Equal(PropertyDocumentGroups.All, Strings(root.GetProperty("groups")));

        var contract = root.GetProperty("types").EnumerateArray().Select(Describe).ToList();
        var backend = PropertyDocumentTypes.All.Select(Describe).ToList();
        Assert.Equal(contract, backend);
    }

    private static string[] Strings(JsonElement array) =>
        array.EnumerateArray().Select(x => x.GetString() ?? "").ToArray();

    private static string Describe(JsonElement t) => string.Join("|",
        t.GetProperty("key").GetString(),
        t.GetProperty("labelAr").GetString(),
        t.GetProperty("group").GetString(),
        t.GetProperty("appliesTo").GetString(),
        t.GetProperty("defaultRequired").GetBoolean(),
        t.GetProperty("uploadableFromTab").GetBoolean(),
        t.GetProperty("pdfOnly").GetBoolean(),
        t.GetProperty("countsAs").ValueKind == JsonValueKind.Null ? "" : t.GetProperty("countsAs").GetString(),
        string.Join(",", Strings(t.GetProperty("legacyScopes"))));

    private static string Describe(PropertyDocumentType t) => string.Join("|",
        t.Key,
        t.LabelAr,
        t.Group,
        t.AppliesTo.ToString().ToLowerInvariant(),
        t.DefaultRequired,
        t.UploadableFromTab,
        t.PdfOnly,
        t.CountsAs ?? "",
        string.Join(",", t.LegacyScopes));
}
