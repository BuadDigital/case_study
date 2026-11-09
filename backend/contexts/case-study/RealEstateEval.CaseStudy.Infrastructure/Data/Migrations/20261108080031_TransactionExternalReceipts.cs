using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class TransactionExternalReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TransactionExternalReceipts",
                schema: "case_study",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Awaited = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReceivedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ReceivedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CancelledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionExternalReceipts", x => x.Id);
                    table.CheckConstraint("CK_TransactionExternalReceipts_Status", "\"Status\" IS NULL OR \"Status\" IN ('pending', 'received', 'cancelled')");
                    table.ForeignKey(
                        name: "FK_TransactionExternalReceipts_Transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalSchema: "case_study",
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TransactionExternalReceipts_TransactionId_Status",
                schema: "case_study",
                table: "TransactionExternalReceipts",
                columns: new[] { "TransactionId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TransactionExternalReceipts",
                schema: "case_study");
        }
    }
}
