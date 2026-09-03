using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts.Financial.Migrations
{
    [DbContext(typeof(FinancialDbContext))]
    [Migration("20260828151000_FinancialReferenceSequences")]
    public partial class FinancialReferenceSequences : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // Numbering workshop: annual DS counters — one row per (prefix × year).
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS financial."FinancialReferenceSequences" (
                    "Id" uuid NOT NULL,
                    "Prefix" character varying(8) NOT NULL,
                    "Year" integer NOT NULL,
                    "LastValue" integer NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_ReferenceSequences" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "UX_financial_ReferenceSequences_Prefix_Year"
                    ON financial."FinancialReferenceSequences" ("Prefix", "Year");
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP TABLE IF EXISTS financial."FinancialReferenceSequences";
                """);
        }
    }
}
