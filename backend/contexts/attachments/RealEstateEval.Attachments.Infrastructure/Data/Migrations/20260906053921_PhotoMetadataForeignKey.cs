using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Attachments.Infrastructure.Data.Contexts.Attachments.Migrations
{
    /// <inheritdoc />
    public partial class PhotoMetadataForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Metadata whose photo was already deleted by hand is unreachable; remove it before the link is enforced.
            migrationBuilder.Sql(
                """
                DELETE FROM attachments."PhotoMetadata" m
                WHERE NOT EXISTS (SELECT 1 FROM attachments."FileAttachments" f WHERE f."Id" = m."PhotoId");
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_PhotoMetadata_FileAttachments_PhotoId",
                schema: "attachments",
                table: "PhotoMetadata",
                column: "PhotoId",
                principalSchema: "attachments",
                principalTable: "FileAttachments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PhotoMetadata_FileAttachments_PhotoId",
                schema: "attachments",
                table: "PhotoMetadata");
        }
    }
}
