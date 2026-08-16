using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class AddDiscountFlags : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DiscountFlags",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    WorkflowTaskId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetAssigneeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    FlaggedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ProposedDiscountSar = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ApprovedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    ResolvedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolutionNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiscountFlags", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DiscountFlags_Status",
                schema: "financial",
                table: "DiscountFlags",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_DiscountFlags_TransactionKey",
                schema: "financial",
                table: "DiscountFlags",
                column: "TransactionKey");

            migrationBuilder.CreateIndex(
                name: "IX_DiscountFlags_TransactionKey_TargetAssigneeId_Status",
                schema: "financial",
                table: "DiscountFlags",
                columns: new[] { "TransactionKey", "TargetAssigneeId", "Status" });
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DiscountFlags",
                schema: "financial");
        }
    }
}
