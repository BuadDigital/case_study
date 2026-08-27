using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Attachments.Infrastructure.Data.Contexts.Attachments.Migrations;

[DbContext(typeof(AttachmentsDbContext))]
[Migration("20260824120000_DropAttachmentReportClassification")]
public partial class DropAttachmentReportClassification : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS attachments."IX_FileAttachments_ScopeKey_PrintInReport";
            ALTER TABLE attachments."FileAttachments" DROP COLUMN IF EXISTS "PrintInReport";
            ALTER TABLE attachments."FileAttachments" DROP COLUMN IF EXISTS "DictionaryTypeKey";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "DictionaryTypeKey",
            schema: "attachments",
            table: "FileAttachments",
            type: "character varying(64)",
            maxLength: 64,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<bool>(
            name: "PrintInReport",
            schema: "attachments",
            table: "FileAttachments",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.CreateIndex(
            name: "IX_FileAttachments_ScopeKey_PrintInReport",
            schema: "attachments",
            table: "FileAttachments",
            columns: new[] { "ScopeKey", "PrintInReport" });
    }
}
