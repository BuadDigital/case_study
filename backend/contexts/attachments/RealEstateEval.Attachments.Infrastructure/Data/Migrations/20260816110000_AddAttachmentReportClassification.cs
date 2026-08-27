using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Attachments.Migrations;

[DbContext(typeof(AttachmentsDbContext))]
[Migration("20260816110000_AddAttachmentReportClassification")]
public partial class AddAttachmentReportClassification : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
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

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_FileAttachments_ScopeKey_PrintInReport",
            schema: "attachments",
            table: "FileAttachments");

        migrationBuilder.DropColumn(
            name: "PrintInReport",
            schema: "attachments",
            table: "FileAttachments");

        migrationBuilder.DropColumn(
            name: "DictionaryTypeKey",
            schema: "attachments",
            table: "FileAttachments");
    }
}
