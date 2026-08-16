using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class AddExpectedPropertyCount : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ExpectedPropertyCount",
                table: "WorkOrders",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.Sql(
                """
                UPDATE "WorkOrders" w
                SET "ExpectedPropertyCount" = GREATEST(1, (
                    SELECT COUNT(*)::int FROM "WorkOrderProperties" p WHERE p."WorkOrderId" = w."Id"
                ))
                WHERE "ExpectedPropertyCount" = 0
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExpectedPropertyCount",
                table: "WorkOrders");
        }
    }
}
