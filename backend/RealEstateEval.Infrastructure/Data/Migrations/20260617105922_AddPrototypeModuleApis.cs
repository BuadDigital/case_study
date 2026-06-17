using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPrototypeModuleApis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FailureTypesCatalogConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CatalogJson = table.Column<string>(type: "jsonb", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FailureTypesCatalogConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FieldDictionaryConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StateJson = table.Column<string>(type: "jsonb", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FieldDictionaryConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FileAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Scope = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ScopeKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    FileName = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Content = table.Column<byte[]>(type: "bytea", nullable: false),
                    UploadedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FileAttachments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PropertyKeyRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Area = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PropertyType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    HasKey = table.Column<bool>(type: "boolean", nullable: false),
                    Specialist = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    WorkflowStatus = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyKeyRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SurveyOffices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ActiveCount = table.Column<int>(type: "integer", nullable: false),
                    DoneMonth = table.Column<int>(type: "integer", nullable: false),
                    AvgDaysLabel = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ContractLabel = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    StatusBusy = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyOffices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ValuationRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PropertyId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Area = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PropertyType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Appraiser = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RequestDate = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValuationRequests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FileAttachments_Scope_ScopeKey",
                table: "FileAttachments",
                columns: new[] { "Scope", "ScopeKey" });

            migrationBuilder.CreateIndex(
                name: "IX_PropertyKeyRecords_PoNumber_PropertyId",
                table: "PropertyKeyRecords",
                columns: new[] { "PoNumber", "PropertyId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyOffices_SortOrder",
                table: "SurveyOffices",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_ValuationRequests_DisplayId",
                table: "ValuationRequests",
                column: "DisplayId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FailureTypesCatalogConfigs");

            migrationBuilder.DropTable(
                name: "FieldDictionaryConfigs");

            migrationBuilder.DropTable(
                name: "FileAttachments");

            migrationBuilder.DropTable(
                name: "PropertyKeyRecords");

            migrationBuilder.DropTable(
                name: "SurveyOffices");

            migrationBuilder.DropTable(
                name: "ValuationRequests");
        }
    }
}
