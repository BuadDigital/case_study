FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY backend/RealEstateEval.Domain/ backend/RealEstateEval.Domain/
COPY backend/RealEstateEval.Application/ backend/RealEstateEval.Application/
COPY backend/RealEstateEval.Infrastructure/ backend/RealEstateEval.Infrastructure/
COPY backend/shared/ backend/shared/
COPY backend/services/case-study/RealEstateEval.CaseStudy.Api/ backend/services/case-study/RealEstateEval.CaseStudy.Api/

RUN dotnet restore backend/services/case-study/RealEstateEval.CaseStudy.Api/RealEstateEval.CaseStudy.Api.csproj
RUN dotnet publish backend/services/case-study/RealEstateEval.CaseStudy.Api/RealEstateEval.CaseStudy.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "RealEstateEval.CaseStudy.Api.dll"]
