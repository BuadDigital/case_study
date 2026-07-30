using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AuditAndVersionPartyFeePricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "financial",
                table: "PartyFeePricingTiers",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "financial",
                table: "PartyFeePricingTables",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "financial",
                table: "PartyFeePricingAssignments",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "financial",
                table: "PartyFeePricingTiers");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "financial",
                table: "PartyFeePricingTables");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "financial",
                table: "PartyFeePricingAssignments");
        }
    }
}
