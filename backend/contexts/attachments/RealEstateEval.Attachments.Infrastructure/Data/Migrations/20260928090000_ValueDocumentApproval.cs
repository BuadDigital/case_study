using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Attachments.Infrastructure.Data.Contexts.Attachments.Migrations;

/// <summary>The case specialist's approval of a «مستند ذو قيمة» (valued-document rows only).</summary>
[DbContext(typeof(AttachmentsDbContext))]
[Migration("20260928090000_ValueDocumentApproval")]
public partial class ValueDocumentApproval : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "ValueDocStatus",
            schema: "attachments",
            table: "FileAttachments",
            type: "character varying(16)",
            maxLength: 16,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ValueDocReviewedBy",
            schema: "attachments",
            table: "FileAttachments",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "ValueDocReviewedAtUtc",
            schema: "attachments",
            table: "FileAttachments",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ValueDocReviewNote",
            schema: "attachments",
            table: "FileAttachments",
            type: "character varying(512)",
            maxLength: 512,
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "CK_FileAttachments_ValueDocStatus",
            schema: "attachments",
            table: "FileAttachments",
            sql: "\"ValueDocStatus\" IS NULL OR \"ValueDocStatus\" IN ('pending', 'approved', 'rejected')");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_FileAttachments_ValueDocStatus",
            schema: "attachments",
            table: "FileAttachments");

        migrationBuilder.DropColumn(name: "ValueDocStatus", schema: "attachments", table: "FileAttachments");
        migrationBuilder.DropColumn(name: "ValueDocReviewedBy", schema: "attachments", table: "FileAttachments");
        migrationBuilder.DropColumn(name: "ValueDocReviewedAtUtc", schema: "attachments", table: "FileAttachments");
        migrationBuilder.DropColumn(name: "ValueDocReviewNote", schema: "attachments", table: "FileAttachments");
    }
}
