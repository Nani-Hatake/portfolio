using System.Text.Json;
using Dapper;
using Portfolio.Api.Data;
using Portfolio.Api.Models;

namespace Portfolio.Api.Repositories;

public class ProjectRepository : IProjectRepository
{
    private readonly ISqlConnectionFactory _factory;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private const string Columns =
        "Id, Title, Summary, Description, TechStackJson, FeaturesJson, MediaJson, GithubLink, LiveDemoLink, SortOrder, CreatedAt, UpdatedAt";

    public ProjectRepository(ISqlConnectionFactory factory) => _factory = factory;

    public async Task<IEnumerable<ProjectDto>> GetAllAsync()
    {
        using var db = _factory.Create();
        var rows = await db.QueryAsync<ProjectRow>(
            $"SELECT {Columns} FROM Projects ORDER BY SortOrder, Id;");
        return rows.Select(Map);
    }

    public async Task<ProjectDto?> GetByIdAsync(int id)
    {
        using var db = _factory.Create();
        var row = await db.QuerySingleOrDefaultAsync<ProjectRow>(
            $"SELECT {Columns} FROM Projects WHERE Id = @id;", new { id });
        return row is null ? null : Map(row);
    }

    public async Task<ProjectDto> CreateAsync(ProjectWriteDto dto)
    {
        using var db = _factory.Create();
        var id = await db.ExecuteScalarAsync<int>(@"
INSERT INTO Projects (Title, Summary, Description, TechStackJson, FeaturesJson, MediaJson, GithubLink, LiveDemoLink, SortOrder)
VALUES (@Title, @Summary, @Description, @TechStackJson, @FeaturesJson, @MediaJson, @GithubLink, @LiveDemoLink, @SortOrder)
RETURNING Id;",
            ToParams(dto));
        return (await GetByIdAsync(id))!;
    }

    public async Task<bool> UpdateAsync(int id, ProjectWriteDto dto)
    {
        using var db = _factory.Create();
        var affected = await db.ExecuteAsync(@"
UPDATE Projects SET
    Title = @Title, Summary = @Summary, Description = @Description,
    TechStackJson = @TechStackJson, FeaturesJson = @FeaturesJson, MediaJson = @MediaJson,
    GithubLink = @GithubLink, LiveDemoLink = @LiveDemoLink, SortOrder = @SortOrder,
    UpdatedAt = now()
WHERE Id = @Id;",
            ToParams(dto, id));
        return affected > 0;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var db = _factory.Create();
        return await db.ExecuteAsync("DELETE FROM Projects WHERE Id = @id;", new { id }) > 0;
    }

    public async Task<int> CountAsync()
    {
        using var db = _factory.Create();
        return await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Projects;");
    }

    // ---- mapping helpers ----

    private static object ToParams(ProjectWriteDto d, int? id = null) => new
    {
        Id = id,
        d.Title,
        d.Summary,
        d.Description,
        TechStackJson = JsonSerializer.Serialize(d.TechStack ?? new(), Json),
        FeaturesJson = JsonSerializer.Serialize(d.Features ?? new(), Json),
        MediaJson = JsonSerializer.Serialize(d.Media ?? new(), Json),
        d.GithubLink,
        d.LiveDemoLink,
        d.SortOrder
    };

    private static ProjectDto Map(ProjectRow r) => new()
    {
        Id = r.Id,
        Title = r.Title,
        Summary = r.Summary,
        Description = r.Description,
        TechStack = Deserialize<List<string>>(r.TechStackJson) ?? new(),
        Features = Deserialize<List<string>>(r.FeaturesJson) ?? new(),
        Media = Deserialize<List<ProjectMedia>>(r.MediaJson) ?? new(),
        GithubLink = r.GithubLink,
        LiveDemoLink = r.LiveDemoLink,
        SortOrder = r.SortOrder,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt
    };

    private static T? Deserialize<T>(string? s)
        => string.IsNullOrWhiteSpace(s) ? default : JsonSerializer.Deserialize<T>(s, Json);
}
