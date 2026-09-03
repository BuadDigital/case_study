using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class AddAdjustmentFactorRationales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ValuationAdjustmentFactorRationales",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    SelectionContext = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    FactorKey = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RationaleAr = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValuationAdjustmentFactorRationales", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ValuationAdjustmentFactorRationales_ValuationRequests_Valua~",
                        column: x => x.ValuationRequestId,
                        principalSchema: "valuation",
                        principalTable: "ValuationRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ValuationAdjFactorRationales_Request_Context_Factor",
                schema: "valuation",
                table: "ValuationAdjustmentFactorRationales",
                columns: new[] { "ValuationRequestId", "SelectionContext", "FactorKey" },
                unique: true);

            // Q-8-1 (data lift): a rationale duplicated literally on every comparable of a factor is lifted to
            // factor level and its rows are cleared — adjustment rows remain "override only".
            migrationBuilder.Sql("""
                INSERT INTO valuation."ValuationAdjustmentFactorRationales"
                    ("Id", "ValuationRequestId", "SelectionContext", "FactorKey", "RationaleAr", "UpdatedAtUtc", "UpdatedByUserId")
                SELECT gen_random_uuid(), s."ValuationRequestId", s."SelectionContext", l."FactorKey",
                       MIN(l."Rationale"), now() AT TIME ZONE 'utc', NULL
                FROM valuation."ValuationComparableAdjustmentLines" l
                JOIN valuation."ValuationComparableSelections" s ON s."Id" = l."SelectionId"
                WHERE COALESCE(l."Rationale", '') <> ''
                GROUP BY s."ValuationRequestId", s."SelectionContext", l."FactorKey"
                HAVING COUNT(DISTINCT l."Rationale") = 1;
                """);

            migrationBuilder.Sql("""
                UPDATE valuation."ValuationComparableAdjustmentLines" l
                SET "Rationale" = ''
                FROM valuation."ValuationComparableSelections" s
                WHERE s."Id" = l."SelectionId"
                  AND EXISTS (
                      SELECT 1 FROM valuation."ValuationAdjustmentFactorRationales" fr
                      WHERE fr."ValuationRequestId" = s."ValuationRequestId"
                        AND fr."SelectionContext" = s."SelectionContext"
                        AND fr."FactorKey" = l."FactorKey"
                        AND fr."RationaleAr" = l."Rationale");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Reverse lift: factor rationale is copied back onto empty rows before dropping the table.
            migrationBuilder.Sql("""
                UPDATE valuation."ValuationComparableAdjustmentLines" l
                SET "Rationale" = fr."RationaleAr"
                FROM valuation."ValuationComparableSelections" s,
                     valuation."ValuationAdjustmentFactorRationales" fr
                WHERE s."Id" = l."SelectionId"
                  AND fr."ValuationRequestId" = s."ValuationRequestId"
                  AND fr."SelectionContext" = s."SelectionContext"
                  AND fr."FactorKey" = l."FactorKey"
                  AND COALESCE(l."Rationale", '') = '';
                """);

            migrationBuilder.DropTable(
                name: "ValuationAdjustmentFactorRationales",
                schema: "valuation");
        }
    }
}
