FROM mcr.microsoft.com/dotnet/sdk:10.0.302@sha256:3dae2f7699441af56216ff64d5c9b6dfce7cd7dc7f4f71d353d29662b10a384f AS build
WORKDIR /src

# Shared.Web references Application, which references Domain — both must be in the context.
COPY backend/RealEstateEval.Domain/ backend/RealEstateEval.Domain/
COPY backend/RealEstateEval.Application/ backend/RealEstateEval.Application/
COPY backend/shared/ backend/shared/
COPY backend/gateway/RealEstateEval.Gateway/ backend/gateway/RealEstateEval.Gateway/

RUN dotnet restore backend/gateway/RealEstateEval.Gateway/RealEstateEval.Gateway.csproj
RUN dotnet publish backend/gateway/RealEstateEval.Gateway/RealEstateEval.Gateway.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0.10@sha256:1f51d2d65ace46d6395e773fb4cfc1c74d36fb4f08e5cf996e7f6961b45e9283
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:5160
EXPOSE 5160

USER $APP_UID

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5160/health || exit 1

ENTRYPOINT ["dotnet", "RealEstateEval.Gateway.dll"]
