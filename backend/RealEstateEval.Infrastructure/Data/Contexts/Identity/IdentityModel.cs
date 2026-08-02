using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The <c>identity</c> schema mapping. Applied by <see cref="IdentityDbContext"/>, which owns
/// the write path, and by the legacy context, which still serves profile/user reads that plan
/// Phase 3 replaces with the Identity API and JWT claims. A single definition keeps the two
/// mappings from drifting while both exist.
/// </summary>
internal static class IdentityModel
{
    public static ModelBuilder ApplyIdentityModel(this ModelBuilder builder)
    {
        builder.Entity<ApplicationUser>(e =>
        {
            e.ToTable("Users", DatabaseSchemas.Identity);
            e.Property(x => x.DisplayName).HasMaxLength(256).IsRequired();
            e.Property(x => x.PhoneNumber).HasMaxLength(20);
            e.HasIndex(x => x.PhoneNumber)
                .IsUnique()
                .HasFilter("\"PhoneNumber\" IS NOT NULL");
        });
        builder.Entity<IdentityRole>(e => e.ToTable("Roles", DatabaseSchemas.Identity));
        builder.Entity<IdentityUserRole<string>>(e => e.ToTable("UserRoles", DatabaseSchemas.Identity));
        builder.Entity<IdentityUserClaim<string>>(e => e.ToTable("UserClaims", DatabaseSchemas.Identity));
        builder.Entity<IdentityRoleClaim<string>>(e => e.ToTable("RoleClaims", DatabaseSchemas.Identity));
        builder.Entity<IdentityUserLogin<string>>(e => e.ToTable("UserLogins", DatabaseSchemas.Identity));
        builder.Entity<IdentityUserToken<string>>(e => e.ToTable("UserTokens", DatabaseSchemas.Identity));

        builder.Entity<UserProfile>(e =>
        {
            e.ToTable("UserProfiles", DatabaseSchemas.Identity, table =>
            {
                table.HasCheckConstraint(
                    "CK_UserProfiles_Status",
                    "\"Status\" BETWEEN 0 AND 3");
                table.HasCheckConstraint(
                    "CK_UserProfiles_FeeValueSar",
                    "\"FeeValueSar\" IS NULL OR \"FeeValueSar\" >= 0");
                table.HasCheckConstraint(
                    "CK_UserProfiles_InspectorType",
                    "\"InspectorType\" IS NULL OR \"InspectorType\" IN ('employee', 'contractor')");
                table.HasCheckConstraint(
                    "CK_UserProfiles_ActiveRequiresRoleAndCity",
                    "\"Status\" <> 0 OR (\"RoleId\" IS NOT NULL AND \"City\" IS NOT NULL)");
            });
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.UserId);
            e.HasOne(x => x.User)
                .WithOne()
                .HasForeignKey<UserProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.JobTitle).HasMaxLength(256);
            e.Property(x => x.RoleId).HasMaxLength(64);
            e.Property(x => x.Department).HasMaxLength(128);
            e.Property(x => x.City).HasMaxLength(128);
            e.Property(x => x.NationalId).HasMaxLength(10);
            e.Property(x => x.AvatarUrl).HasMaxLength(2048);
            e.Property(x => x.InspectorType).HasMaxLength(32);
            e.Property(x => x.FeeValueSar).HasPrecision(18, 2);
            e.Property(x => x.Iban).HasMaxLength(34);
            e.Property(x => x.TaxNumber).HasMaxLength(32);
            e.Property(x => x.CommercialRegistration).HasMaxLength(64);
            e.Property(x => x.DistributionAssigneeId).HasMaxLength(128);
            e.Property(x => x.ReviewerCityCoverageJson).HasMaxLength(1024);
            e.Property(x => x.PermissionLevel).HasMaxLength(64);
            e.HasIndex(x => x.RoleId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.NationalId)
                .IsUnique()
                .HasFilter("\"NationalId\" IS NOT NULL");
            e.HasIndex(x => x.DistributionAssigneeId);
        });

        builder.Entity<RefreshToken>(e =>
        {
            e.ToTable("RefreshTokens", DatabaseSchemas.Identity);
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.Property(x => x.RevokedReason).HasMaxLength(128);
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.SessionId);
            e.HasIndex(x => x.ExpiresAtUtc);
            e.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<HrEmployeeProfile>(e =>
        {
            e.ToTable("HrEmployeeProfiles", DatabaseSchemas.Identity);
            e.HasKey(x => x.UserId);
            e.HasOne(x => x.Profile)
                .WithOne(x => x.HrEmployee)
                .HasForeignKey<HrEmployeeProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.EmploymentType).HasMaxLength(64);
            e.Property(x => x.Department).HasMaxLength(256);
            e.Property(x => x.Section).HasMaxLength(256);
        });

        builder.Entity<ProcServiceProviderProfile>(e =>
        {
            e.ToTable("ProcServiceProviderProfiles", DatabaseSchemas.Identity);
            e.HasKey(x => x.UserId);
            e.HasOne(x => x.Profile)
                .WithOne(x => x.ProcProvider)
                .HasForeignKey<ProcServiceProviderProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.ServiceType).HasMaxLength(128);
        });

        return builder;
    }
}
