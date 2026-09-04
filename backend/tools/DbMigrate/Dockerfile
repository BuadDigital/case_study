# One-shot EF migrator for deploy-time schema updates (not used as a long-running service).
FROM mcr.microsoft.com/dotnet/sdk:10.0.302@sha256:3dae2f7699441af56216ff64d5c9b6dfce7cd7dc7f4f71d353d29662b10a384f AS build
WORKDIR /src

COPY backend/RealEstateEval.Application/ backend/RealEstateEval.Application/
COPY backend/RealEstateEval.Infrastructure/ backend/RealEstateEval.Infrastructure/
COPY backend/contexts/ backend/contexts/
COPY backend/shared/ backend/shared/
COPY backend/tools/DbMigrate/ backend/tools/DbMigrate/

RUN dotnet restore backend/tools/DbMigrate/DbMigrate.csproj
RUN dotnet publish backend/tools/DbMigrate/DbMigrate.csproj -c Release -o /app/publish --no-restore

# aspnet, not runtime: Infrastructure carries ASP.NET code (health endpoints), so the
# migrator inherits a FrameworkReference on Microsoft.AspNetCore.App and the plain
# runtime image cannot start it.
FROM mcr.microsoft.com/dotnet/aspnet:10.0.10@sha256:1f51d2d65ace46d6395e773fb4cfc1c74d36fb4f08e5cf996e7f6961b45e9283
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "RealEstateEval.DbMigrate.dll"]
