FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY backend/shared/ backend/shared/
COPY backend/gateway/RealEstateEval.Gateway/ backend/gateway/RealEstateEval.Gateway/

RUN dotnet restore backend/gateway/RealEstateEval.Gateway/RealEstateEval.Gateway.csproj
RUN dotnet publish backend/gateway/RealEstateEval.Gateway/RealEstateEval.Gateway.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:5160
EXPOSE 5160
ENTRYPOINT ["dotnet", "RealEstateEval.Gateway.dll"]
