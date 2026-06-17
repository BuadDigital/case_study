using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDelegationLettersAndEvaluatorRecalls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EvaluatorRecallRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PropertyId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Reason = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    SpecialistNote = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    RequestedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluatorRecallRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InternalDelegationLetterSets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    LettersJson = table.Column<string>(type: "jsonb", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InternalDelegationLetterSets", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluatorRecallRecords_Status",
                table: "EvaluatorRecallRecords",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluatorRecallRecords_TaskId",
                table: "EvaluatorRecallRecords",
                column: "TaskId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InternalDelegationLetterSets_PoNumber",
                table: "InternalDelegationLetterSets",
                column: "PoNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EvaluatorRecallRecords");

            migrationBuilder.DropTable(
                name: "InternalDelegationLetterSets");
        }
    }
}
