using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Numbering ruling 2026-11-08: every deed has its own PR number; a linked property's number is its
/// root deed's number + «-L», the root being the smallest number when the deeds are linked.
/// </summary>
public class TransactionReferenceRulesTests
{
    [Fact]
    public void One_deed_is_its_own_number_and_none_gives_nothing()
    {
        Assert.Equal("PR-26-00123", TransactionReferenceRules.PropertyReference(["PR-26-00123"], null, locked: false));
        Assert.Null(TransactionReferenceRules.PropertyReference([null, " "], "PR-26-00001", locked: false));
    }

    [Fact]
    public void Linking_takes_the_smallest_number_as_the_root()
    {
        // Numeric order, and the old four-digit year sorts with the short one.
        Assert.Equal(
            "PR-26-00009-L",
            TransactionReferenceRules.PropertyReference(["PR-26-00120", "PR-26-00009"], "PR-26-00120", locked: false));
        Assert.Equal(
            "PR-2025-00500-L",
            TransactionReferenceRules.PropertyReference(["PR-26-00001", "PR-2025-00500"], null, locked: false));
    }

    [Fact]
    public void A_later_deed_does_not_move_the_root()
    {
        // Already linked: a smaller deed joining keeps the root.
        Assert.Equal(
            "PR-26-00050-L",
            TransactionReferenceRules.PropertyReference(
                ["PR-26-00050", "PR-26-00060", "PR-26-00010"], "PR-26-00050-L", locked: false));
        // A single property whose report was approved keeps its number as the root.
        Assert.Equal(
            "PR-26-00050-L",
            TransactionReferenceRules.PropertyReference(["PR-26-00050", "PR-26-00010"], "PR-26-00050", locked: true));
    }

    [Fact]
    public void The_root_leaving_re_derives_from_the_smallest_left()
    {
        Assert.Equal(
            "PR-26-00060-L",
            TransactionReferenceRules.PropertyReference(["PR-26-00070", "PR-26-00060"], "PR-26-00050-L", locked: false));
        Assert.Equal(
            "PR-26-00070",
            TransactionReferenceRules.PropertyReference(["PR-26-00070"], "PR-26-00050-L", locked: false));
    }

    [Fact]
    public void Report_numbers_keep_the_linked_suffix()
    {
        Assert.Equal("PRV-26-00123-L", ReferenceNumbering.ValuationReportNumber("PR-26-00123-L"));
        Assert.Equal("PRC-26-00123-L", ReferenceNumbering.CaseStudyReportNumber("PR-26-00123-L"));
        Assert.Equal("PRV-26-00123-L/2", ReferenceNumbering.WithVersion("PRV-26-00123-L", 2));
        Assert.Equal("PR-26-00123", ReferenceNumbering.RootOf("PR-26-00123-L"));
        Assert.Equal("PR-26-00123-L", ReferenceNumbering.Linked("PR-26-00123-L"));
    }

    [Fact]
    public void A_deed_is_numbered_once_and_refreshes_its_property()
    {
        var now = DateTime.UtcNow;
        var transaction = Transaction.Create(now);
        var deed = new WorkOrderProperty { Id = Guid.NewGuid(), Transaction = transaction, TransactionId = transaction.Id };
        transaction.Properties.Add(deed);

        Assert.True(deed.AssignReferenceNumber("PR-26-00007", now));
        Assert.Equal("PR-26-00007", transaction.ReferenceNumber);
        Assert.False(deed.AssignReferenceNumber("PR-26-00008", now));
        Assert.Equal("PR-26-00007", deed.ReferenceNumber);

        // Locking does not change the number and is done once.
        Assert.True(transaction.LockReference(now));
        Assert.False(transaction.LockReference(now));
        Assert.Equal("PR-26-00007", transaction.DisplayNumber);
    }
}
