# ---- build stage ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# restore (cached layer)
COPY *.csproj ./
RUN dotnet restore

# publish
COPY . ./
RUN dotnet publish -c Release -o /app /p:UseAppHost=false

# ---- runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_ENVIRONMENT=Production
# Render injects PORT at runtime; Program.cs binds to it. 8080 is the local default.
EXPOSE 8080
ENTRYPOINT ["dotnet", "Portfolio.Api.dll"]
