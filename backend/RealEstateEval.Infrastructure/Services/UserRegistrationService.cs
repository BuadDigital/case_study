using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Permissions;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace RealEstateEval.Infrastructure.Services;

public class UserRegistrationService : IUserRegistrationService
{
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public UserRegistrationService(
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<IReadOnlyList<UserListItemDto>> ListAsync(
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .Include(p => p.CrmClient)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var userIds = rows.Select(p => p.UserId).ToList();
        var roleRows = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where userIds.Contains(ur.UserId)
            select new { ur.UserId, RoleName = r.Name }
        ).ToListAsync(cancellationToken);

        var rolesByUser = roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.RoleName).ToList());

        return rows
            .Where(p => sourceScope is null || p.RegistrationSource == sourceScope.Value)
            .Select(p => RegistrationMapper.ToListItem(
                p.User,
                p,
                rolesByUser.GetValueOrDefault(p.UserId, [])))
            .ToList();
    }

    public async Task<IReadOnlyList<UserListItemDto>> ListDistributionAssigneesAsync(
        CancellationToken cancellationToken = default)
    {
        var all = await ListAsync(null, cancellationToken);
        return all
            .Where(u =>
                u.Status == UserStatus.Active
                && !string.IsNullOrWhiteSpace(u.DistributionAssigneeId))
            .ToList();
    }

    public async Task<OrganizationOverviewDto> GetOrganizationOverviewAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .ToListAsync(cancellationToken);

        var userIds = rows.Select(p => p.UserId).ToList();
        var roleRows = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where userIds.Contains(ur.UserId)
            select new { ur.UserId, RoleName = r.Name }
        ).ToListAsync(cancellationToken);

        var rolesByUser = roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.RoleName).ToList());

        OrgPersonDto? ToPerson(UserProfile p)
        {
            var roles = rolesByUser.GetValueOrDefault(p.UserId, []);
            var orgRole = roles.FirstOrDefault(r =>
                OrgRoles.IsOrgRole(r)
                || OrgRoles.RetiredDepartmentAdmins.Contains(r));
            if (orgRole is null)
                return null;

            return new OrgPersonDto
            {
                Id = p.UserId,
                DisplayName = p.User.DisplayName,
                Email = p.User.Email ?? string.Empty,
                JobTitle = p.JobTitle,
                SystemRole = orgRole,
            };
        }

        var byRole = rows
            .Select(p => (Profile: p, Person: ToPerson(p)))
            .Where(x => x.Person is not null)
            .ToDictionary(x => x.Person!.SystemRole, x => x.Person!);

        return new OrganizationOverviewDto
        {
            Cdo = byRole.GetValueOrDefault(OrgRoles.Cdo),
            Departments =
            [
                new OrgDepartmentDto
                {
                    Code = "HR",
                    Title = "الموارد البشرية",
                    Description = "موظفون — كل أنواع التوظيف",
                    IsActive = true,
                    Admin = byRole.GetValueOrDefault(OrgRoles.HrAdmin),
                },
                new OrgDepartmentDto
                {
                    Code = "PROCUREMENT",
                    Title = "المالية والعقود",
                    Description = "مقدمو خدمة — أفراد ومؤسسات",
                    IsActive = true,
                    Admin = byRole.GetValueOrDefault(OrgRoles.ProcAdmin),
                },
                new OrgDepartmentDto
                {
                    Code = "CRM",
                    Title = "علاقات العملاء",
                    Description = "عملاء محتملون وفعليون",
                    IsActive = false,
                    Admin = byRole.GetValueOrDefault(OrgRoles.CrmAdmin),
                },
            ],
        };
    }

    public async Task<int> DeleteAllRegisteredAsync(
        CancellationToken cancellationToken = default)
    {
        const string protectedEmail = "admin@local.dev";

        var userIds = await _db.UserProfiles
            .Select(p => p.UserId)
            .ToListAsync(cancellationToken);

        var deleted = 0;
        foreach (var userId in userIds)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user is null)
                continue;

            var email = (user.Email ?? "").Trim().ToLowerInvariant();
            if (email == protectedEmail)
                continue;

            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Any(OrgRoles.IsOrgRole))
                continue;

            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    "Failed to delete user " + userId + ": "
                    + string.Join("; ", result.Errors.Select(e => e.Description)));
            }

            deleted++;
        }

        return deleted;
    }

    public async Task<(CreateStaffUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateStaffAsync(
        CreateStaffUserRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = ValidateCreateStaffRequest(request);
        if (errors.Count > 0)
            return (null, errors);

        var roleId = request.RoleId.Trim();
        var jobTitle = PrototypeRoleResolver.JobTitleForRoleId(roleId)!;
        var defaults = StaffRoleDefaults.For(roleId);
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var displayName = request.DisplayName.Trim();

        var existingEmail = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existingEmail is not null)
        {
            return (null, new Dictionary<string, string>
            {
                ["email"] = "البريد الإلكتروني مستخدم مسبقاً.",
            });
        }

        var userName = await AllocateUniqueUserNameAsync(normalizedEmail, cancellationToken);
        var temporaryPassword = GenerateTemporaryPassword();

        var user = new ApplicationUser
        {
            UserName = userName,
            Email = normalizedEmail,
            EmailConfirmed = true,
            DisplayName = displayName,
        };

        var createResult = await _userManager.CreateAsync(user, temporaryPassword);
        if (!createResult.Succeeded)
        {
            return (null, new Dictionary<string, string>
            {
                ["_form"] = string.Join(" ", createResult.Errors.Select(e => e.Description)),
            });
        }

        foreach (var identityRole in defaults.IdentityRoles.Distinct())
        {
            await _userManager.AddToRoleAsync(user, identityRole);
        }

        var profile = new UserProfile
        {
            UserId = user.Id,
            RegistrationSource = RegistrationSource.Hr,
            ContractType = defaults.ContractType,
            JobTitle = jobTitle,
            DistributionAssigneeId = BuildDistributionAssigneeId(roleId, userName),
            PermissionLevel = defaults.PermissionLevel,
            Status = UserStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            HrEmployee = new HrEmployeeProfile
            {
                UserId = user.Id,
                EmploymentType = defaults.EmploymentType,
                Department = defaults.Department,
                Section = defaults.Section,
                NationalId = string.IsNullOrWhiteSpace(request.NationalId)
                    ? null
                    : request.NationalId.Trim(),
                EmployeeNumber = string.IsNullOrWhiteSpace(request.EmployeeNumber)
                    ? null
                    : request.EmployeeNumber.Trim(),
            },
        };

        _db.UserProfiles.Add(profile);
        await _db.SaveChangesAsync(cancellationToken);

        var roles = (IReadOnlyList<string>)[.. await _userManager.GetRolesAsync(user)];
        var dto = RegistrationMapper.ToListItem(user, profile, roles);
        return (new CreateStaffUserResponseDto
        {
            User = dto,
            UserName = userName,
            TemporaryPassword = temporaryPassword,
        }, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteStaffAsync(
        string userId,
        string? requestingUserId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (false, "معرّف المستخدم غير صالح.");

        if (!string.IsNullOrWhiteSpace(requestingUserId)
            && string.Equals(userId, requestingUserId, StringComparison.Ordinal))
        {
            return (false, "لا يمكنك حذف حسابك الحالي.");
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return (false, "المستخدم غير موجود.");

        var email = (user.Email ?? "").Trim().ToLowerInvariant();
        var userName = (user.UserName ?? "").Trim().ToLowerInvariant();
        if (email is "admin@local.dev" or "s.salhy@gmail.com"
            || userName is "sliman" or "admin")
        {
            return (false, "لا يمكن حذف حساب المسؤول الأساسي.");
        }

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return (
                false,
                string.Join(" ", result.Errors.Select(e => e.Description)));
        }

        return (true, null);
    }

    private static Dictionary<string, string> ValidateCreateStaffRequest(CreateStaffUserRequest request)
    {
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(request.DisplayName))
            errors["displayName"] = "الاسم مطلوب.";
        if (string.IsNullOrWhiteSpace(request.Email))
            errors["email"] = "البريد الإلكتروني مطلوب.";
        else if (!IsValidEmail(request.Email.Trim()))
            errors["email"] = "صيغة البريد الإلكتروني غير صحيحة.";
        if (string.IsNullOrWhiteSpace(request.RoleId))
            errors["roleId"] = "الدور مطلوب.";
        else if (!PrototypeRoleResolver.IsCreatableStaffRoleId(request.RoleId))
            errors["roleId"] = "الدور المحدد غير مدعوم.";

        return errors;
    }

    private static bool IsValidEmail(string email) =>
        Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");

    private async Task<string> AllocateUniqueUserNameAsync(
        string normalizedEmail,
        CancellationToken cancellationToken)
    {
        var baseName = DeriveUserNameFromEmail(normalizedEmail);
        var candidate = baseName;
        var suffix = 2;

        while (await _db.Users.AsNoTracking().AnyAsync(u => u.UserName == candidate, cancellationToken))
        {
            candidate = $"{baseName}-{suffix}";
            suffix++;
        }

        return candidate;
    }

    private static string DeriveUserNameFromEmail(string normalizedEmail)
    {
        var local = normalizedEmail.Split('@')[0].Trim().ToLowerInvariant();
        var sanitized = Regex.Replace(local, @"[^a-z0-9._-]", "_");
        sanitized = sanitized.Trim('_', '.', '-');
        if (string.IsNullOrWhiteSpace(sanitized))
            sanitized = "user";
        return sanitized.Length > 50 ? sanitized[..50] : sanitized;
    }

    private static string BuildDistributionAssigneeId(string roleId, string userName)
    {
        var prefix = roleId switch
        {
            "cdo" => "cdo",
            "general-manager" => "gm",
            "section-supervisor" => "ss",
            "case-specialist" => "cs",
            "government-reviewer" => "gov",
            "valuation-coordinator" => "vc",
            "real-estate-appraiser" => "val",
            "field-inspector" => "fi",
            "financial-officer" => "fo",
            _ => "usr",
        };

        var slug = Regex.Replace(userName.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(slug))
            slug = "user";

        return $"{prefix}-{slug}";
    }

    private static string GenerateTemporaryPassword()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        Span<char> chars = stackalloc char[12];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        }

        return new string(chars);
    }

    private sealed record StaffRoleDefaults(
        string PermissionLevel,
        string EmploymentType,
        string Department,
        string? Section,
        ContractType ContractType,
        IReadOnlyList<string> IdentityRoles)
    {
        public static StaffRoleDefaults For(string roleId) =>
            roleId switch
            {
                "cdo" => new(
                    "cdo",
                    "دوام كامل",
                    "الإدارة التنفيذية",
                    null,
                    ContractType.Internal,
                    [OrgRoles.Cdo, DepartmentRoles.Hr]),
                "general-manager" => new(
                    "مدير",
                    "دوام كامل",
                    "إدارة التقييم العقاري",
                    null,
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "section-supervisor" => new(
                    "مشرف",
                    "دوام كامل",
                    "إدارة التقييم العقاري",
                    "قسم دراسة الحالة",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Supervisor"]),
                "case-specialist" => new(
                    "محرر",
                    "دوام كامل",
                    "إدارة التقييم العقاري",
                    "قسم دراسة الحالة",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "government-reviewer" => new(
                    "محرر",
                    "دوام كامل",
                    "إدارة التقييم العقاري",
                    "قسم دراسة الحالة",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "valuation-coordinator" => new(
                    "مشرف",
                    "دوام كامل",
                    "إدارة التقييم العقاري",
                    "قسم تقييم الأفراد",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Supervisor"]),
                "real-estate-appraiser" => new(
                    "محرر",
                    "دوام كامل",
                    "إدارة التقييم العقاري",
                    "قسم تقييم الأفراد",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "field-inspector" => new(
                    "محرر",
                    "دوام كامل",
                    "إدارة التقييم العقاري",
                    "قسم تقييم الأفراد",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                "financial-officer" => new(
                    "محرر",
                    "دوام كامل",
                    "الإدارة المالية",
                    "قسم المحاسبة",
                    ContractType.Internal,
                    [DepartmentRoles.Hr, "Editor"]),
                _ => throw new ArgumentOutOfRangeException(nameof(roleId), roleId, null),
            };
    }
}
