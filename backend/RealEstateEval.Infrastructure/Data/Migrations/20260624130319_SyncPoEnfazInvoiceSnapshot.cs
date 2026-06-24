using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SyncPoEnfazInvoiceSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PoEnfazInvoices",
                schema: "financial",
                columns: table => new
                {
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    InvoiceNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    IssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PoEnfazInvoices", x => x.PoNumber);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PoEnfazInvoices",
                schema: "financial");
        }
    }
}
