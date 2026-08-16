using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>
/// Snapshot-only sync. Schema for answer provenance / submission actors already
/// exists via <c>20260726160000_AddAnswerProvenanceAndSubmissionActors</c>;
/// EF Core refused MigrateAsync until the model snapshot matched.
/// </summary>
public partial class SyncModelSnapshot : Migration
{
 /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
    }

 /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
