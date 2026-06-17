FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY backend/RealEstateEval.Domain/ backend/RealEstateEval.Domain/
COPY backend/RealEstateEval.Application/ backend/RealEstateEval.Application/
COPY backend/RealEstateEval.Infrastructure/ backend/RealEstateEval.Infrastructure/
COPY backend/shared/ backend/shared/
COPY backend/services/identity/RealEstateEval.Identity.Api/ backend/services/identity/RealEstateEval.Identity.Api/

RUN dotnet restore backend/services/identity/RealEstateEval.Identity.Api/RealEstateEval.Identity.Api.csproj
RUN dotnet publish backend/services/identity/RealEstateEval.Identity.Api/RealEstateEval.Identity.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "RealEstateEval.Identity.Api.dll"]
