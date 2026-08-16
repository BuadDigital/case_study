using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class DropUnusedPropertyBoundaryFields : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Boundaries",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "BoundariesMatch",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "Restrictions",
                table: "WorkOrderProperties");
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Boundaries",
                table: "WorkOrderProperties",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BoundariesMatch",
                table: "WorkOrderProperties",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Restrictions",
                table: "WorkOrderProperties",
                type: "text",
                nullable: true);
        }
    }
}
