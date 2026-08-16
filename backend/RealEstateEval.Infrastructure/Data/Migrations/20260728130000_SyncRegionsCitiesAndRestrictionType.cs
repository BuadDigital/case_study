using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>
/// Snapshot sync for Regions/Cities + WorkOrderProperty region fields
/// (already applied via <c>20260728120000_AddRegionsCitiesCatalog</c>), and
/// widens RestrictionType for multi-select values.
/// </summary>
public partial class SyncRegionsCitiesAndRestrictionType : Migration
{
 /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."WorkOrderProperties"
                ALTER COLUMN "RestrictionType" TYPE character varying(128);
            """);
    }

 /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."WorkOrderProperties"
                ALTER COLUMN "RestrictionType" TYPE character varying(32);
            """);
    }
}
