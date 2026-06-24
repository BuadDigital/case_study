using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <inheritdoc />
public partial class AddPoEnfazInvoices : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE TABLE IF NOT EXISTS financial."PoEnfazInvoices"
            (
                "PoNumber" character varying(64) NOT NULL,
                "InvoiceNumber" character varying(128) NOT NULL,
                "IssuedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_PoEnfazInvoices" PRIMARY KEY ("PoNumber")
            );
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""DROP TABLE IF EXISTS financial."PoEnfazInvoices";""");
    }
}
