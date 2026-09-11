using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Attachments.Infrastructure.Data.Contexts.Attachments.Migrations
{
    /// <inheritdoc />
    public partial class PropertyDocumentGovernance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomDocumentLabel",
                schema: "attachments",
                table: "FileAttachments",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomDocumentReason",
                schema: "attachments",
                table: "FileAttachments",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentTypeKey",
                schema: "attachments",
                table: "FileAttachments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

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

            // Classify existing uploads by the field they came from (PropertyDocumentTypes.LegacyScopes).
            migrationBuilder.Sql(
                """
                UPDATE attachments."FileAttachments"
                SET "DocumentTypeKey" = CASE
                    WHEN "Scope" = 'field-inspection-photo' AND "ScopeKey" LIKE '%:component:buildLicense'
                        THEN 'building-permit'
                    WHEN "Scope" = 'field-inspection-photo' THEN 'inspection-photo'
                    WHEN "Scope" = 'property-deed-ownership' THEN 'deed'
                    WHEN "Scope" = 'property-bourse-deed' THEN 'bourse-deed'
                    WHEN "Scope" = 'property-registry' THEN 'real-estate-registry'
                    WHEN "Scope" = 'property-boundaries' THEN 'boundaries-document'
                    WHEN "Scope" = 'property-decree' THEN 'assignment-letter'
                    WHEN "Scope" = 'property-delegation' THEN 'delegation-letter'
                    WHEN "Scope" = 'engineering-survey-report' THEN 'survey'
                    WHEN "Scope" = 'engineering-site-letter' THEN 'site-letter'
                    WHEN "Scope" = 'evaluator-report' THEN 'valuation-report'
                    WHEN "Scope" = 'evaluator-deposit-certificate' THEN 'deposit-certificate'
                    WHEN "Scope" = 'property-other' THEN 'unlisted'
                END
                WHERE "DocumentTypeKey" IS NULL;
                """);

            // «Other documents» uploaded before governance have no name or reason: queue them for review.
            migrationBuilder.Sql(
                """
                UPDATE attachments."FileAttachments"
                SET "CustomDocumentLabel" = 'مستند إضافي',
                    "CustomDocumentReason" = 'رُفع قبل تفعيل حوكمة المستندات',
                    "ReviewStatus" = 'pending'
                WHERE "Scope" = 'property-other' AND "CustomDocumentLabel" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_FileAttachments_ReviewStatus",
                schema: "attachments",
                table: "FileAttachments");

            migrationBuilder.DropColumn(
                name: "CustomDocumentLabel",
                schema: "attachments",
                table: "FileAttachments");

            migrationBuilder.DropColumn(
                name: "CustomDocumentReason",
                schema: "attachments",
                table: "FileAttachments");

            migrationBuilder.DropColumn(
                name: "DocumentTypeKey",
                schema: "attachments",
                table: "FileAttachments");

            migrationBuilder.DropColumn(
                name: "ReviewNote",
                schema: "attachments",
                table: "FileAttachments");

            migrationBuilder.DropColumn(
                name: "ReviewStatus",
                schema: "attachments",
                table: "FileAttachments");

            migrationBuilder.DropColumn(
                name: "ReviewedAtUtc",
                schema: "attachments",
                table: "FileAttachments");

            migrationBuilder.DropColumn(
                name: "ReviewedByUserId",
                schema: "attachments",
                table: "FileAttachments");
        }
    }
}
