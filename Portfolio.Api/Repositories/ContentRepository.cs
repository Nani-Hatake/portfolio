using System.Text.Json;
using Dapper;
using Portfolio.Api.Data;
using Portfolio.Api.Models;

namespace Portfolio.Api.Repositories;

public class ContentRepository : IContentRepository
{
    private readonly ISqlConnectionFactory _factory;

    public ContentRepository(ISqlConnectionFactory factory) => _factory = factory;

    public async Task<IEnumerable<ContentItemDto>> GetSectionAsync(string section)
    {
        using var db = _factory.Create();
        var rows = await db.QueryAsync<ContentRow>(
            "SELECT Id, Section, DataJson, SortOrder FROM ContentItems WHERE Section = @section ORDER BY SortOrder, Id;",
            new { section });
        return rows.Select(Map);
    }

    public async Task<ContentItemDto?> GetItemAsync(string section, int id)
    {
        using var db = _factory.Create();
        var row = await db.QuerySingleOrDefaultAsync<ContentRow>(
            "SELECT Id, Section, DataJson, SortOrder FROM ContentItems WHERE Section = @section AND Id = @id;",
            new { section, id });
        return row is null ? null : Map(row);
    }

    public async Task<ContentItemDto> CreateAsync(string section, ContentWriteDto dto)
    {
        using var db = _factory.Create();
        var id = await db.ExecuteScalarAsync<int>(@"
INSERT INTO ContentItems (Section, DataJson, SortOrder)
VALUES (@section, @DataJson, @SortOrder)
RETURNING Id;",
            new { section, DataJson = RawJson(dto.Data), dto.SortOrder });
        return (await GetItemAsync(section, id))!;
    }

    public async Task<bool> UpdateAsync(string section, int id, ContentWriteDto dto)
    {
        using var db = _factory.Create();
        var affected = await db.ExecuteAsync(@"
UPDATE ContentItems
SET DataJson = @DataJson, SortOrder = @SortOrder, UpdatedAt = now()
WHERE Section = @section AND Id = @id;",
            new { section, id, DataJson = RawJson(dto.Data), dto.SortOrder });
        return affected > 0;
    }

    public async Task<bool> DeleteAsync(string section, int id)
    {
        using var db = _factory.Create();
        return await db.ExecuteAsync(
            "DELETE FROM ContentItems WHERE Section = @section AND Id = @id;",
            new { section, id }) > 0;
    }

    public async Task<int> CountAsync(string section)
    {
        using var db = _factory.Create();
        return await db.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM ContentItems WHERE Section = @section;", new { section });
    }

    private static string RawJson(JsonElement data)
        => data.ValueKind == JsonValueKind.Undefined ? "{}" : data.GetRawText();

    private static ContentItemDto Map(ContentRow r) => new()
    {
        Id = r.Id,
        SortOrder = r.SortOrder,
        Data = JsonSerializer.Deserialize<JsonElement>(
            string.IsNullOrWhiteSpace(r.DataJson) ? "{}" : r.DataJson)
    };
}
