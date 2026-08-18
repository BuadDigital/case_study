using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Validation;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Attachments.Api;

public sealed class ServiceModule : IRealEstateEvalServiceModule
{
    public string ServiceName => "attachments";
    public string OpenApiTitle => "Attachments API";
    public string? ConnectionStringKey => ServiceDatabaseNames.Attachments;

    public void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString)
    {
        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddClaimsPermissionService();
        // A8: blob storage folds into the context registration below.
        builder.Services.AddAttachmentsInfrastructure(builder.Configuration, connectionString!);
        // A8: the attachment validators live in the Attachments context assembly, outside
        // the global-Application scan in AddRealEstateEvalValidation.
        builder.Services.AddValidatorsFromAssemblyContaining<UploadAttachmentRequestValidator>();
    }

    public async Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        if (app.Environment.IsDevelopment())
        {
            await using var scope = app.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AttachmentsDbContext>();
            await PostgresDatabaseProvisioner.EnsureExistsAsync(db.Database.GetConnectionString());
        }

        app.MapDatabaseReady<AttachmentsDbContext>(ServiceName);
    }
}
