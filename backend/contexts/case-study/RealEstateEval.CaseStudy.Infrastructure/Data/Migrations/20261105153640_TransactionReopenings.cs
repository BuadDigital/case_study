using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class TransactionReopenings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TransactionReopenings",
                schema: "case_study",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    EnfazReference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ReopensStudy = table.Column<bool>(type: "boolean", nullable: false),
                    ReopensValuation = table.Column<bool>(type: "boolean", nullable: false),
                    NeedsFieldWork = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    OpenedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OpenedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    OpenedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UploadedAgainAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ClosedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionReopenings", x => x.Id);
                    table.CheckConstraint("CK_TransactionReopenings_Source", "\"Source\" IS NULL OR \"Source\" IN ('enfaz', 'internal')");
                    table.CheckConstraint("CK_TransactionReopenings_Status", "\"Status\" IS NULL OR \"Status\" IN ('open', 'awaiting_reply', 'closed')");
                    table.ForeignKey(
                        name: "FK_TransactionReopenings_Transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalSchema: "case_study",
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TransactionReopenings_Status",
                schema: "case_study",
                table: "TransactionReopenings",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionReopenings_TransactionId_Status",
                schema: "case_study",
                table: "TransactionReopenings",
                columns: new[] { "TransactionId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TransactionReopenings",
                schema: "case_study");
        }
    }
}
