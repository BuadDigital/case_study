using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPartyFeePricingAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PartyFeePricingAssignments",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TableId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AssigneeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PartyFeePricingAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PartyFeePricingAssignments_PartyFeePricingTables_TableId",
                        column: x => x.TableId,
                        principalSchema: "financial",
                        principalTable: "PartyFeePricingTables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PartyFeePricingAssignments_Category_AssigneeId",
                schema: "financial",
                table: "PartyFeePricingAssignments",
                columns: new[] { "Category", "AssigneeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PartyFeePricingAssignments_TableId",
                schema: "financial",
                table: "PartyFeePricingAssignments",
                column: "TableId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PartyFeePricingAssignments",
                schema: "financial");
        }
    }
}
