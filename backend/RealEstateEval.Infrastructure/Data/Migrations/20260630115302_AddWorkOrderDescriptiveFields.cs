using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkOrderDescriptiveFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PropertiesRegion",
                schema: "case_study",
                table: "WorkOrders",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkOrderDescription",
                schema: "case_study",
                table: "WorkOrders",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PropertiesRegion",
                schema: "case_study",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "WorkOrderDescription",
                schema: "case_study",
                table: "WorkOrders");
        }
    }
}
