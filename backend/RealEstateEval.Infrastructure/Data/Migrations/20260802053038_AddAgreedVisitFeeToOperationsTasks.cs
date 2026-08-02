using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAgreedVisitFeeToOperationsTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AgreedVisitFeeSar",
                schema: "case_study",
                table: "OperationsTasks",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "VisitFeePricingTableId",
                schema: "case_study",
                table: "OperationsTasks",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AgreedVisitFeeSar",
                schema: "case_study",
                table: "OperationsTasks");

            migrationBuilder.DropColumn(
                name: "VisitFeePricingTableId",
                schema: "case_study",
                table: "OperationsTasks");
        }
    }
}
