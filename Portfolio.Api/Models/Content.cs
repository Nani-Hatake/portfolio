using System.Text.Json;

namespace Portfolio.Api.Models;

/// <summary>A single content item returned to the client. Data is arbitrary JSON.</summary>
public class ContentItemDto
{
    public int Id { get; set; }
    public int SortOrder { get; set; }
    public JsonElement Data { get; set; }
}

/// <summary>Payload for creating/updating a content item.</summary>
public class ContentWriteDto
{
    public int SortOrder { get; set; }
    public JsonElement Data { get; set; }
}

internal class ContentRow
{
    public int Id { get; set; }
    public string Section { get; set; } = "";
    public string DataJson { get; set; } = "{}";
    public int SortOrder { get; set; }
}
