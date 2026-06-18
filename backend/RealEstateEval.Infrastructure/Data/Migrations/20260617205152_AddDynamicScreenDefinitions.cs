using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDynamicScreenDefinitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Code",
                schema: "platform",
                table: "CustomAssignedScreens",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DefinitionJson",
                schema: "platform",
                table: "CustomAssignedScreens",
                type: "jsonb",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OwnerRole",
                schema: "platform",
                table: "CustomAssignedScreens",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ScreenStatus",
                schema: "platform",
                table: "CustomAssignedScreens",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "CustomScreenSubmissions",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    AnswersJson = table.Column<string>(type: "jsonb", nullable: false),
                    IsDraft = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomScreenSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomScreenSubmissions_CustomAssignedScreens_ScreenId",
                        column: x => x.ScreenId,
                        principalSchema: "platform",
                        principalTable: "CustomAssignedScreens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomAssignedScreens_Code",
                schema: "platform",
                table: "CustomAssignedScreens",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_CustomScreenSubmissions_ScreenId_UserId",
                schema: "platform",
                table: "CustomScreenSubmissions",
                columns: new[] { "ScreenId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomScreenSubmissions",
                schema: "platform");

            migrationBuilder.DropIndex(
                name: "IX_CustomAssignedScreens_Code",
                schema: "platform",
                table: "CustomAssignedScreens");

            migrationBuilder.DropColumn(
                name: "Code",
                schema: "platform",
                table: "CustomAssignedScreens");

            migrationBuilder.DropColumn(
                name: "DefinitionJson",
                schema: "platform",
                table: "CustomAssignedScreens");

            migrationBuilder.DropColumn(
                name: "OwnerRole",
                schema: "platform",
                table: "CustomAssignedScreens");

            migrationBuilder.DropColumn(
                name: "ScreenStatus",
                schema: "platform",
                table: "CustomAssignedScreens");
        }
    }
}
