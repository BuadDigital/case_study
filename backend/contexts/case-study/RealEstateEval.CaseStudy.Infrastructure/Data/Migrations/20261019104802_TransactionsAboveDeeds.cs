using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <summary>
    /// Decision 2026-10-19: the transaction (المعاملة) becomes the reference above the deeds.
    /// Every existing deed gets its own draft transaction: the old per-deed TX number is carried
    /// over as the draft number (TX- → D-) so nothing printed so far changes meaning, and the
    /// TX counter rows become the D counter. No official PR number is given retroactively; it is
    /// drawn at the next report approval. The grouped-property tables are dropped.
    /// </summary>
    public partial class TransactionsAboveDeeds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PropertyGroupMembers",
                schema: "case_study");

            migrationBuilder.DropTable(
                name: "PropertyGroups",
                schema: "case_study");

            migrationBuilder.AddColumn<Guid>(
                name: "TransactionId",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Transactions",
                schema: "case_study",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DraftNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ReferenceNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    ConfirmedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LinkKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    LinkReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    MergedIntoTransactionId = table.Column<Guid>(type: "uuid", nullable: true),
                    MergedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MergedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transactions", x => x.Id);
                    table.CheckConstraint("CK_Transactions_LinkKind", "\"LinkKind\" IS NULL OR \"LinkKind\" IN ('one_building', 'contract')");
                    table.ForeignKey(
                        name: "FK_Transactions_Transactions_MergedIntoTransactionId",
                        column: x => x.MergedIntoTransactionId,
                        principalSchema: "case_study",
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // One draft transaction per existing deed; the old TX number becomes its draft number.
            migrationBuilder.Sql(
                """
                UPDATE case_study."WorkOrderProperties"
                SET "TransactionId" = gen_random_uuid()
                WHERE "TransactionId" IS NULL;

                INSERT INTO case_study."Transactions"
                    ("Id", "DraftNumber", "ReferenceNumber", "CreatedAtUtc", "UpdatedAtUtc")
                SELECT
                    p."TransactionId",
                    COALESCE(
                        NULLIF(replace(p."ReferenceNumber", 'TX-', 'D-'), ''),
                        'D-0000-' || lpad((row_number() OVER (ORDER BY p."UpdatedAtUtc", p."Id"))::text, 5, '0')),
                    NULL,
                    COALESCE(p."UpdatedAtUtc", now()),
                    COALESCE(p."UpdatedAtUtc", now())
                FROM case_study."WorkOrderProperties" p;

                UPDATE case_study."CaseStudyReferenceSequences" s
                SET "Prefix" = 'D'
                WHERE s."Prefix" = 'TX'
                  AND NOT EXISTS (
                      SELECT 1 FROM case_study."CaseStudyReferenceSequences" d
                      WHERE d."Prefix" = 'D' AND d."Year" = s."Year");
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "TransactionId",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderProperties_ReferenceNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "ReferenceNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_TransactionId",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "TransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_DraftNumber",
                schema: "case_study",
                table: "Transactions",
                column: "DraftNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_MergedIntoTransactionId",
                schema: "case_study",
                table: "Transactions",
                column: "MergedIntoTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_ReferenceNumber",
                schema: "case_study",
                table: "Transactions",
                column: "ReferenceNumber",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkOrderProperties_Transactions_TransactionId",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "TransactionId",
                principalSchema: "case_study",
                principalTable: "Transactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkOrderProperties_Transactions_TransactionId",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropTable(
                name: "Transactions",
                schema: "case_study");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderProperties_TransactionId",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "TransactionId",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.AddColumn<string>(
                name: "ReferenceNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PropertyGroups",
                schema: "case_study",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PropertyGroupMembers",
                schema: "case_study",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LinkedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LinkedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SuggestionSignals = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    UnlinkReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    UnlinkedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UnlinkedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyGroupMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PropertyGroupMembers_PropertyGroups_GroupId",
                        column: x => x.GroupId,
                        principalSchema: "case_study",
                        principalTable: "PropertyGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PropertyGroupMembers_WorkOrderProperties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "case_study",
                        principalTable: "WorkOrderProperties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_ReferenceNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "ReferenceNumber");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyGroupMembers_GroupId",
                schema: "case_study",
                table: "PropertyGroupMembers",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyGroupMembers_PropertyId_IsActive",
                schema: "case_study",
                table: "PropertyGroupMembers",
                columns: new[] { "PropertyId", "IsActive" });
        }
    }
}
