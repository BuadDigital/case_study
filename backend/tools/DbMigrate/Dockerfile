# One-shot EF migrator for deploy-time schema updates (not used as a long-running service).
FROM mcr.microsoft.com/dotnet/sdk:10.0.302@sha256:3dae2f7699441af56216ff64d5c9b6dfce7cd7dc7f4f71d353d29662b10a384f AS build
WORKDIR /src

COPY backend/RealEstateEval.Domain/ backend/RealEstateEval.Domain/
COPY backend/RealEstateEval.Application/ backend/RealEstateEval.Application/
COPY backend/RealEstateEval.Infrastructure/ backend/RealEstateEval.Infrastructure/
COPY backend/shared/ backend/shared/
COPY backend/tools/DbMigrate/ backend/tools/DbMigrate/

RUN dotnet restore backend/tools/DbMigrate/DbMigrate.csproj
RUN dotnet publish backend/tools/DbMigrate/DbMigrate.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/runtime:10.0.10@sha256:ca17638b4cbab2063771e8943dbe887ea6c0ae00c5fede3498d5938758c85dfe
WORKDIR /app
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "RealEstateEval.DbMigrate.dll"]
