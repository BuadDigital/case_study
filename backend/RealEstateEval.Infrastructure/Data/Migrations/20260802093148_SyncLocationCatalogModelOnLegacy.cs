using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class SyncLocationCatalogModelOnLegacy : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // Snapshot mirrors expanded Regions/Cities + Districts from PlatformModel.
 // Platform owns the schema change (ExpandOfficialRegionsCitiesCatalog) — do not alter here.
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
