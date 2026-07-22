using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Portfolio.Api.Data;
using Portfolio.Api.Repositories;
using Portfolio.Api.Security;

var builder = WebApplication.CreateBuilder(args);

// Bind to the port the host injects (Render/Heroku set PORT); fall back to 5080 locally.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// ---- services ----
builder.Services.AddControllers();

var connectionString = ResolveConnectionString(builder.Configuration);
builder.Services.AddSingleton<ISqlConnectionFactory>(_ => new SqlConnectionFactory(connectionString));
builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<IContentRepository, ContentRepository>();
builder.Services.AddScoped<IAdminRepository, AdminRepository>();
builder.Services.AddScoped<DatabaseInitializer>();
builder.Services.AddSingleton<TokenService>();

// JWT authentication
var jwt = builder.Configuration.GetSection("Jwt");
var jwtKey = jwt["Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key is missing or too short. Set the Jwt__Key environment variable (>= 32 characters).");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// ---- initialize database (apply schema, seed) ----
using (var scope = app.Services.CreateScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await initializer.InitializeAsync();
}

// ---- pipeline ----
app.UseCors();
app.UseDefaultFiles();   // serve wwwroot/index.html at "/"
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// SPA fallback so client routes like /projects/5 work on deep links / refresh.
app.MapFallbackToFile("index.html");

app.Run();


// Resolves the PostgreSQL connection string. Prefers ConnectionStrings:Default
// (local dev / appsettings.Development.json); otherwise parses the DATABASE_URL
// env var that Render provides (postgres://user:pass@host:port/dbname).
static string ResolveConnectionString(IConfiguration config)
{
    var fromConfig = config.GetConnectionString("Default");
    if (!string.IsNullOrWhiteSpace(fromConfig)) return fromConfig;

    var url = Environment.GetEnvironmentVariable("DATABASE_URL");
    if (string.IsNullOrWhiteSpace(url))
        throw new InvalidOperationException(
            "No database configured. Set ConnectionStrings__Default or the DATABASE_URL environment variable.");

    var uri = new Uri(url);
    var creds = uri.UserInfo.Split(':', 2);
    var b = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Username = Uri.UnescapeDataString(creds[0]),
        Password = creds.Length > 1 ? Uri.UnescapeDataString(creds[1]) : string.Empty,
        Database = uri.AbsolutePath.Trim('/'),
        SslMode = SslMode.Require,
        TrustServerCertificate = true
    };
    return b.ConnectionString;
}
