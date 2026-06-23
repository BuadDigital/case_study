using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260623080000_AddAssigneeCoverageAndInspectorFees")]
/// <inheritdoc />
public partial class AddAssigneeCoverageAndInspectorFees : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "DistributionAssigneeId",
            schema: "identity",
            table: "UserProfiles",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ReviewerCityCoverageJson",
            schema: "identity",
            table: "UserProfiles",
            type: "character varying(1024)",
            maxLength: 1024,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_UserProfiles_DistributionAssigneeId",
            schema: "identity",
            table: "UserProfiles",
            column: "DistributionAssigneeId");

        migrationBuilder.CreateTable(
            name: "InspectorFeeLedgers",
            schema: "case_study",
            columns: table => new
            {
                WorkflowTaskId = table.Column<Guid>(type: "uuid", nullable: false),
                PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                PropertyOrdinal = table.Column<int>(type: "integer", nullable: false),
                AssigneeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                InspectorType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                AgreedFeeSar = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                SupervisorDiscountSar = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                DiscountReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                BillingStatus = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_InspectorFeeLedgers", x => x.WorkflowTaskId);
            });

        migrationBuilder.CreateIndex(
            name: "IX_InspectorFeeLedgers_AssigneeId",
            schema: "case_study",
            table: "InspectorFeeLedgers",
            column: "AssigneeId");

        migrationBuilder.CreateIndex(
            name: "IX_InspectorFeeLedgers_BillingStatus",
            schema: "case_study",
            table: "InspectorFeeLedgers",
            column: "BillingStatus");

        migrationBuilder.CreateIndex(
            name: "IX_InspectorFeeLedgers_PoNumber",
            schema: "case_study",
            table: "InspectorFeeLedgers",
            column: "PoNumber");

        migrationBuilder.Sql(
            """
            UPDATE identity."UserProfiles" p
            SET "ReviewerCityCoverageJson" = '["الرياض","الطائف"]'
            FROM identity."Users" u
            WHERE p."UserId" = u."Id"
              AND LOWER(u."Email") = 'feras@ejadah.dev'
              AND (p."ReviewerCityCoverageJson" IS NULL OR p."ReviewerCityCoverageJson" = '');
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "InspectorFeeLedgers",
            schema: "case_study");

        migrationBuilder.DropIndex(
            name: "IX_UserProfiles_DistributionAssigneeId",
            schema: "identity",
            table: "UserProfiles");

        migrationBuilder.DropColumn(
            name: "ReviewerCityCoverageJson",
            schema: "identity",
            table: "UserProfiles");

        migrationBuilder.DropColumn(
            name: "DistributionAssigneeId",
            schema: "identity",
            table: "UserProfiles");
    }
}
