using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class OperationsTaskOutputsAccepted : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "OutputsAcceptedAtUtc",
                schema: "operations",
                table: "OperationsTasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OutputsAcceptedByName",
                schema: "operations",
                table: "OperationsTasks",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OutputsAcceptedByUserId",
                schema: "operations",
                table: "OperationsTasks",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OutputsAcceptedAtUtc",
                schema: "operations",
                table: "OperationsTasks");

            migrationBuilder.DropColumn(
                name: "OutputsAcceptedByName",
                schema: "operations",
                table: "OperationsTasks");

            migrationBuilder.DropColumn(
                name: "OutputsAcceptedByUserId",
                schema: "operations",
                table: "OperationsTasks");
        }
    }
}
