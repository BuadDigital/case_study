using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Attachments.Infrastructure.Data.Contexts.Attachments.Migrations
{
    /// <inheritdoc />
    public partial class DropInlineAttachmentContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Refuses to drop bytes that were never moved: run `DbMigrate attachment-blobs` first.
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM attachments."FileAttachments" WHERE "Content" IS NOT NULL) THEN
                        RAISE EXCEPTION 'attachments.FileAttachments still holds inline content; run "DbMigrate attachment-blobs" before this migration';
                    END IF;
                END $$;
                """);

            migrationBuilder.DropColumn(
                name: "Content",
                schema: "attachments",
                table: "FileAttachments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "Content",
                schema: "attachments",
                table: "FileAttachments",
                type: "bytea",
                nullable: true);
        }
    }
}
