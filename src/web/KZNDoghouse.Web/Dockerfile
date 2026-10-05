FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["src/web/KZNDoghouse.Web/KZNDoghouse.Web.csproj", "src/web/KZNDoghouse.Web/"]
RUN dotnet restore "src/web/KZNDoghouse.Web/KZNDoghouse.Web.csproj"

COPY . .
WORKDIR "/src/src/web/KZNDoghouse.Web"
RUN dotnet publish "KZNDoghouse.Web.csproj" \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:10000
EXPOSE 10000

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "KZNDoghouse.Web.dll"]
