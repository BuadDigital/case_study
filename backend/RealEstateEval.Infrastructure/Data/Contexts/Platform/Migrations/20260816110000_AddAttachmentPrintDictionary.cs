using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Platform.Migrations;

[DbContext(typeof(PlatformDbContext))]
[Migration("20260816110000_AddAttachmentPrintDictionary")]
public partial class AddAttachmentPrintDictionary : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "AttachmentPrintDictionaryConfigs",
            schema: "platform",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CatalogJson = table.Column<string>(type: "jsonb", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AttachmentPrintDictionaryConfigs", x => x.Id);
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "AttachmentPrintDictionaryConfigs",
            schema: "platform");
    }
}
