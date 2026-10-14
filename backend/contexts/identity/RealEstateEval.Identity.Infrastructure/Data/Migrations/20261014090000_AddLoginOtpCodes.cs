using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Identity.Infrastructure.Data.Migrations
{
    /// <summary>SMS login codes (hash only), one row per issued code.</summary>
    [DbContext(typeof(IdentityDbContext))]
    [Migration("20261014090000_AddLoginOtpCodes")]
    public partial class AddLoginOtpCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS identity."LoginOtpCodes"
                (
                    "Id" uuid NOT NULL,
                    "Mobile" character varying(20) NOT NULL,
                    "UserId" character varying(128) NOT NULL,
                    "CodeHash" character varying(64) NOT NULL,
                    "Channel" character varying(16) NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "ExpiresAtUtc" timestamp with time zone NOT NULL,
                    "Attempts" integer NOT NULL DEFAULT 0,
                    "ConsumedAtUtc" timestamp with time zone NULL,
                    CONSTRAINT "PK_LoginOtpCodes" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_LoginOtpCodes_Users_UserId"
                        FOREIGN KEY ("UserId") REFERENCES identity."Users" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "CK_LoginOtpCodes_Attempts" CHECK ("Attempts" >= 0)
                );
                CREATE INDEX IF NOT EXISTS "IX_LoginOtpCodes_Mobile_CreatedAtUtc"
                    ON identity."LoginOtpCodes" ("Mobile", "CreatedAtUtc");
                CREATE INDEX IF NOT EXISTS "IX_LoginOtpCodes_UserId"
                    ON identity."LoginOtpCodes" ("UserId");
                CREATE INDEX IF NOT EXISTS "IX_LoginOtpCodes_ExpiresAtUtc"
                    ON identity."LoginOtpCodes" ("ExpiresAtUtc");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS identity."LoginOtpCodes";""");
        }
    }
}
