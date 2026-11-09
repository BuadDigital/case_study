using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class TransactionReceiptAndWorkMarker : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReceivedAtUtc",
                schema: "case_study",
                table: "Transactions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceivedByName",
                schema: "case_study",
                table: "Transactions",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceivedByUserId",
                schema: "case_study",
                table: "Transactions",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            // Launch (ruling 2026-11-02): a transaction whose field parties already delivered — or whose
            // study is finished — counts as formally received, so no study in progress is blocked by the
            // new receipt gate. One still waiting for an inspector / survey stays with coordination.
            migrationBuilder.Sql(
                """
                UPDATE case_study."Transactions" t
                SET "ReceivedAtUtc" = now() AT TIME ZONE 'utc',
                    "ReceivedByName" = 'استلام تلقائي عند الإطلاق'
                WHERE t."ReceivedAtUtc" IS NULL
                  AND EXISTS (
                    SELECT 1
                    FROM case_study."WorkOrderProperties" p
                    JOIN case_study."WorkflowTasks" w
                      ON w."PropertyId" = p."Id"
                     AND w."Kind" = 'case-study-property'
                     AND w."ParentTaskId" IS NULL
                     AND w."Status" <> 'cancelled'
                    WHERE p."TransactionId" = t."Id"
                      AND (
                        w."Phase" = 'done'
                        OR ((w."Phase" = 'case-study'
                             OR (w."Phase" = 'obstruction' AND w."ObstructionPriorPhase" = 'case-study'))
                            AND NOT EXISTS (
                              SELECT 1
                              FROM case_study."WorkflowTasks" c
                              LEFT JOIN case_study."PartyTaskSubmissions" s ON s."WorkflowTaskId" = c."Id"
                              WHERE c."ParentTaskId" = w."Id"
                                AND c."Kind" IN ('field-inspection', 'engineering-survey')
                                AND c."Status" <> 'cancelled'
                                AND COALESCE(s."Status", 'draft') <> 'submitted'))));
                """);

            migrationBuilder.CreateTable(
                name: "TransactionWorkMarkers",
                schema: "case_study",
                columns: table => new
                {
                    TransactionId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    AtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionWorkMarkers", x => x.TransactionId);
                    table.ForeignKey(
                        name: "FK_TransactionWorkMarkers_Transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalSchema: "case_study",
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TransactionWorkMarkers",
                schema: "case_study");

            migrationBuilder.DropColumn(
                name: "ReceivedAtUtc",
                schema: "case_study",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ReceivedByName",
                schema: "case_study",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ReceivedByUserId",
                schema: "case_study",
                table: "Transactions");
        }
    }
}
