using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class AddComparableQualityTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDuplicateTagged",
                schema: "valuation",
                table: "ComparableProperties",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ReliabilityTag",
                schema: "valuation",
                table: "ComparableProperties",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TagRationale",
                schema: "valuation",
                table: "ComparableProperties",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TaggedAtUtc",
                schema: "valuation",
                table: "ComparableProperties",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaggedByUserId",
                schema: "valuation",
                table: "ComparableProperties",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TransactionReference",
                schema: "valuation",
                table: "ComparableProperties",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Usage",
                schema: "valuation",
                table: "ComparableProperties",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDuplicateTagged",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.DropColumn(
                name: "ReliabilityTag",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.DropColumn(
                name: "TagRationale",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.DropColumn(
                name: "TaggedAtUtc",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.DropColumn(
                name: "TaggedByUserId",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.DropColumn(
                name: "TransactionReference",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.DropColumn(
                name: "Usage",
                schema: "valuation",
                table: "ComparableProperties");
        }
    }
}
