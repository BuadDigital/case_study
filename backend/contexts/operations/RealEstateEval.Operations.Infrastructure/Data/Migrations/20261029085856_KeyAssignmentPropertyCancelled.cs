using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts.Operations.Migrations
{
    /// <inheritdoc />
    public partial class KeyAssignmentPropertyCancelled : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PropertyCancelledAtUtc",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PropertyCancelledAtUtc",
                schema: "operations",
                table: "KeyEnvelopeAssignments");
        }
    }
}
