using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class AddPropertyFailures : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PropertyFailures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PropertyId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DeedNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ProblemTypeId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Severity = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RaisedByRole = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    InternalNote = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    FinalNote = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    ResolutionReason = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    ContinueInstructions = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Specialist = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyFailures", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PropertyFailures_PoNumber",
                table: "PropertyFailures",
                column: "PoNumber");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyFailures_PoNumber_PropertyId",
                table: "PropertyFailures",
                columns: new[] { "PoNumber", "PropertyId" });
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PropertyFailures");
        }
    }
}
