using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Web;

public static class ServiceHealthEndpoints
{
    public static WebApplication MapDatabaseReady(this WebApplication app, string serviceName)
    {
        app.MapGet("/ready", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            try
            {
                if (!await db.Database.CanConnectAsync(ct))
                {
                    return Results.Json(
                        new { status = "not_ready", service = serviceName },
                        statusCode: StatusCodes.Status503ServiceUnavailable);
                }

                return Results.Ok(new { status = "ready", service = serviceName });
            }
            catch
            {
                return Results.Json(
                    new { status = "not_ready", service = serviceName },
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }
        });

        return app;
    }
}
