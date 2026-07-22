using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260722152000_AddCourtVisitFeeCharges")]
public partial class AddCourtVisitFeeCharges : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CourtVisitFeeCharges",
            schema: "financial",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                OperationsTaskId = table.Column<Guid>(type: "uuid", nullable: false),
                TaskDisplayId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                CreditAssigneeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                CreditAssigneeName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                AmountSar = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CourtVisitFeeCharges", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_CourtVisitFeeCharges_OperationsTaskId",
            schema: "financial",
            table: "CourtVisitFeeCharges",
            column: "OperationsTaskId",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_CourtVisitFeeCharges_CreditAssigneeId",
            schema: "financial",
            table: "CourtVisitFeeCharges",
            column: "CreditAssigneeId");

        migrationBuilder.CreateIndex(
            name: "IX_CourtVisitFeeCharges_Status",
            schema: "financial",
            table: "CourtVisitFeeCharges",
            column: "Status");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "CourtVisitFeeCharges",
            schema: "financial");
    }
}
