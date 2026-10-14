using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts.Operations.Migrations;

/// <summary>
/// The survey-offices registry was a prototype list with hand-seeded rows; engineering
/// offices are staff accounts with the engineering-office role and are chosen from there.
/// </summary>
[DbContext(typeof(OperationsDbContext))]
[Migration("20261013140000_DropSurveyOffices")]
public partial class DropSurveyOffices : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""DROP TABLE IF EXISTS operations."SurveyOffices";""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE TABLE IF NOT EXISTS operations."SurveyOffices"
            (
                "Id" uuid NOT NULL,
                "ActiveCount" integer NOT NULL,
                "AvgDaysLabel" character varying(64) NOT NULL,
                "ContractLabel" character varying(128) NOT NULL,
                "DoneMonth" integer NOT NULL,
                "Name" character varying(256) NOT NULL,
                "SortOrder" integer NOT NULL,
                "StatusBusy" boolean NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_SurveyOffices" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_SurveyOffices_SortOrder"
                ON operations."SurveyOffices" ("SortOrder");
            """);
    }
}
