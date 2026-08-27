using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Platform.Infrastructure.Data.Contexts.Platform.Migrations;

[DbContext(typeof(PlatformDbContext))]
[Migration("20260816150000_AddDifferenceFactorCatalog")]
public partial class AddDifferenceFactorCatalog : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "DifferenceFactorCatalogConfigs",
            schema: "platform",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CatalogJson = table.Column<string>(type: "jsonb", nullable: false),
                Version = table.Column<int>(type: "integer", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_DifferenceFactorCatalogConfigs", x => x.Id);
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "DifferenceFactorCatalogConfigs",
            schema: "platform");
    }
}
