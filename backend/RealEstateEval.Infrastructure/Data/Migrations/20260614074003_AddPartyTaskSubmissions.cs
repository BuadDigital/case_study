using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class AddPartyTaskSubmissions : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PartyTaskSubmissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkflowTaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    ReturnNote = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PartyTaskSubmissions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PartyTaskSubmissions_PoNumber",
                table: "PartyTaskSubmissions",
                column: "PoNumber");

            migrationBuilder.CreateIndex(
                name: "IX_PartyTaskSubmissions_WorkflowTaskId",
                table: "PartyTaskSubmissions",
                column: "WorkflowTaskId",
                unique: true);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PartyTaskSubmissions");
        }
    }
}
