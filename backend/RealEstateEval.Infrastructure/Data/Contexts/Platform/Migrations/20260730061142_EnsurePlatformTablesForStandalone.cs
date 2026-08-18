using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Platform.Migrations;

/// <summary>
/// Empty platform baseline assumed the shared database already had catalog tables.
/// A dedicated platform database has no legacy stream, so this creates the baseline
/// tables when they are missing. AuditLogs are created by a later platform migration.
/// </summary>
[DbContext(typeof(PlatformDbContext))]
[Migration("20260730061142_EnsurePlatformTablesForStandalone")]
public class EnsurePlatformTablesForStandalone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE SCHEMA IF NOT EXISTS platform;

            CREATE TABLE IF NOT EXISTS platform."Regions"
            (
                "Id" uuid NOT NULL,
                "CapitalAr" character varying(100) NOT NULL,
                "Code" character varying(4) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "IsActive" boolean NOT NULL,
                "NameAr" character varying(100) NOT NULL,
                CONSTRAINT "PK_Regions" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Regions_Code" ON platform."Regions" ("Code");
            CREATE INDEX IF NOT EXISTS "IX_Regions_IsActive" ON platform."Regions" ("IsActive");

            CREATE TABLE IF NOT EXISTS platform."Cities"
            (
                "Id" uuid NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "IsActive" boolean NOT NULL,
                "IsCapital" boolean NOT NULL,
                "NameAr" character varying(100) NOT NULL,
                "RegionId" uuid NOT NULL,
                CONSTRAINT "PK_Cities" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_Cities_IsActive" ON platform."Cities" ("IsActive");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Cities_RegionId_NameAr"
                ON platform."Cities" ("RegionId", "NameAr");

            CREATE TABLE IF NOT EXISTS platform."Courts"
            (
                "Id" uuid NOT NULL,
                "City" character varying(80) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreatedBy" character varying(128) NOT NULL,
                "IsActive" boolean NOT NULL,
                "Name" character varying(150) NOT NULL,
                "Region" character varying(80) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL,
                "UpdatedBy" character varying(128) NULL,
                CONSTRAINT "PK_Courts" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_Courts_IsActive" ON platform."Courts" ("IsActive");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Courts_Name_City" ON platform."Courts" ("Name", "City");
            CREATE INDEX IF NOT EXISTS "IX_Courts_Region_City" ON platform."Courts" ("Region", "City");

            CREATE TABLE IF NOT EXISTS platform."CourtCircuits"
            (
                "Id" uuid NOT NULL,
                "CircuitName" character varying(150) NULL,
                "CircuitNo" character varying(50) NOT NULL,
                "CourtId" uuid NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreatedBy" character varying(128) NOT NULL,
                "IsActive" boolean NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL,
                "UpdatedBy" character varying(128) NULL,
                CONSTRAINT "PK_CourtCircuits" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_CourtCircuits_IsActive" ON platform."CourtCircuits" ("IsActive");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CourtCircuits_CourtId_CircuitNo"
                ON platform."CourtCircuits" ("CourtId", "CircuitNo");

            CREATE TABLE IF NOT EXISTS platform."CourtAuditLogs"
            (
                "Id" uuid NOT NULL,
                "Action" character varying(64) NOT NULL,
                "ActorId" character varying(128) NOT NULL,
                "ChangesJson" jsonb NOT NULL,
                "EntityId" uuid NOT NULL,
                "EntityType" character varying(32) NOT NULL,
                "TimestampUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_CourtAuditLogs" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_CourtAuditLogs_Action" ON platform."CourtAuditLogs" ("Action");
            CREATE INDEX IF NOT EXISTS "IX_CourtAuditLogs_TimestampUtc"
                ON platform."CourtAuditLogs" ("TimestampUtc");
            CREATE INDEX IF NOT EXISTS "IX_CourtAuditLogs_EntityType_EntityId"
                ON platform."CourtAuditLogs" ("EntityType", "EntityId");

            CREATE TABLE IF NOT EXISTS platform."CourtCatalogEntries"
            (
                "Id" uuid NOT NULL,
                "CircuitsJson" jsonb NOT NULL,
                "City" character varying(128) NOT NULL,
                "Court" character varying(256) NOT NULL,
                CONSTRAINT "PK_CourtCatalogEntries" PRIMARY KEY ("Id")
            );

            CREATE TABLE IF NOT EXISTS platform."FieldDictionaryConfigs"
            (
                "Id" uuid NOT NULL,
                "StateJson" jsonb NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_FieldDictionaryConfigs" PRIMARY KEY ("Id")
            );

            CREATE TABLE IF NOT EXISTS platform."CaseStudyInfoRolesConfigs"
            (
                "Id" uuid NOT NULL,
                "MatrixJson" jsonb NOT NULL,
                "NotesJson" jsonb NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_CaseStudyInfoRolesConfigs" PRIMARY KEY ("Id")
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
