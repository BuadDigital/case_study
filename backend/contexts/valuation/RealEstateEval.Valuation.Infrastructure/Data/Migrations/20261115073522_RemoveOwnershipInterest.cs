using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <summary>
    /// The appraiser's «نوع الملكية المقيَّمة» list is removed (Omar 2026-11-15): the ownership type comes
    /// from the initial data only (the «مشاع» tick beside the owner name). The interest key and the
    /// remaining lease years are dropped; a valuation that held usufruct / leased land loses its lease cap
    /// on depreciation. Down re-adds both columns with every row back on «freehold».
    /// </summary>
    public partial class RemoveOwnershipInterest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OwnershipInterestKey",
                schema: "valuation",
                table: "ValuationApproachSettings");

            migrationBuilder.DropColumn(
                name: "RemainingLeaseYears",
                schema: "valuation",
                table: "ValuationApproachSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OwnershipInterestKey",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "freehold");

            migrationBuilder.AddColumn<decimal>(
                name: "RemainingLeaseYears",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "numeric(6,2)",
                precision: 6,
                scale: 2,
                nullable: true);
        }
    }
}
