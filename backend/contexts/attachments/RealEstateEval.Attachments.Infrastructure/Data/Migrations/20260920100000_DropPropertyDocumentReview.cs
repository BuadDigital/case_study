using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Attachments.Infrastructure.Data.Contexts.Attachments.Migrations;

[DbContext(typeof(AttachmentsDbContext))]
[Migration("20260920100000_DropPropertyDocumentReview")]
public partial class DropPropertyDocumentReview : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE attachments."FileAttachments" DROP CONSTRAINT IF EXISTS "CK_FileAttachments_ReviewStatus";
            ALTER TABLE attachments."FileAttachments" DROP COLUMN IF EXISTS "ReviewStatus";
            ALTER TABLE attachments."FileAttachments" DROP COLUMN IF EXISTS "ReviewNote";
            ALTER TABLE attachments."FileAttachments" DROP COLUMN IF EXISTS "ReviewedAtUtc";
            ALTER TABLE attachments."FileAttachments" DROP COLUMN IF EXISTS "ReviewedByUserId";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "ReviewNote",
            schema: "attachments",
            table: "FileAttachments",
            type: "character varying(512)",
            maxLength: 512,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ReviewStatus",
            schema: "attachments",
            table: "FileAttachments",
            type: "character varying(16)",
            maxLength: 16,
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "ReviewedAtUtc",
            schema: "attachments",
            table: "FileAttachments",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ReviewedByUserId",
            schema: "attachments",
            table: "FileAttachments",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "CK_FileAttachments_ReviewStatus",
            schema: "attachments",
            table: "FileAttachments",
            sql: "\"ReviewStatus\" IS NULL OR \"ReviewStatus\" IN ('pending', 'approved', 'rejected')");
    }
}
