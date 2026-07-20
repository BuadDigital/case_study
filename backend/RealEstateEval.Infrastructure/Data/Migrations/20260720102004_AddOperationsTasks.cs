using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOperationsTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OperationsTasks",
                schema: "case_study",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Scope = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DeedsJson = table.Column<string>(type: "jsonb", nullable: true),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    AssigneeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    AssigneeName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PrevStatus = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    Priority = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DueAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reference = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    LetterRowsJson = table.Column<string>(type: "jsonb", nullable: true),
                    CommentsJson = table.Column<string>(type: "jsonb", nullable: true),
                    RemindersJson = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationsTasks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OperationsTaskSequences",
                schema: "case_study",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    NextSeq = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationsTaskSequences", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OperationsTasks_AssigneeId",
                schema: "case_study",
                table: "OperationsTasks",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsTasks_DisplayId",
                schema: "case_study",
                table: "OperationsTasks",
                column: "DisplayId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OperationsTasks_DueAtUtc",
                schema: "case_study",
                table: "OperationsTasks",
                column: "DueAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsTasks_Status",
                schema: "case_study",
                table: "OperationsTasks",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsTaskSequences_Year",
                schema: "case_study",
                table: "OperationsTaskSequences",
                column: "Year",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OperationsTasks",
                schema: "case_study");

            migrationBuilder.DropTable(
                name: "OperationsTaskSequences",
                schema: "case_study");
        }
    }
}
