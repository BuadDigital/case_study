using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Attachments.Migrations;

/// <summary>
/// The attachments baseline is empty because tables originally came from the legacy stream
/// on the shared database. A dedicated attachments database has no legacy stream, so this
/// creates <c>FileAttachments</c> when it is missing. <c>IF NOT EXISTS</c> keeps the
/// migration safe on the shared database where the table already exists.
/// </summary>
[DbContext(typeof(AttachmentsDbContext))]
[Migration("20260730061122_EnsureFileAttachmentsForStandalone")]
public class EnsureFileAttachmentsForStandalone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE SCHEMA IF NOT EXISTS attachments;

            CREATE TABLE IF NOT EXISTS attachments."FileAttachments"
            (
                "Id" uuid NOT NULL,
                "Scope" character varying(64) NOT NULL,
                "ScopeKey" character varying(512) NOT NULL,
                "FileName" character varying(512) NOT NULL,
                "ContentType" character varying(128) NOT NULL,
                "StorageKey" character varying(1024) NULL,
                "Content" bytea NULL,
                "SizeBytes" bigint NOT NULL,
                "UploadedByUserId" character varying(450) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_FileAttachments" PRIMARY KEY ("Id")
            );

            CREATE INDEX IF NOT EXISTS "IX_FileAttachments_Scope_ScopeKey"
                ON attachments."FileAttachments" ("Scope", "ScopeKey");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Not dropped: on the shared database this table still belongs to the legacy stream.
    }
}
