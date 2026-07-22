namespace Portfolio.Api.Models;

/// <summary>A single media item on a project detail page (image or video).</summary>
public class ProjectMedia
{
    public string Type { get; set; } = "image"; // "image" | "video"
    public string Url { get; set; } = "";
    public string? Caption { get; set; }
}

/// <summary>Project as returned to the client (JSON columns expanded to arrays).</summary>
public class ProjectDto
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Description { get; set; } = "";
    public List<string> TechStack { get; set; } = new();
    public List<string> Features { get; set; } = new();
    public List<ProjectMedia> Media { get; set; } = new();
    public string? GithubLink { get; set; }
    public string? LiveDemoLink { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Payload for creating/updating a project.</summary>
public class ProjectWriteDto
{
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Description { get; set; } = "";
    public List<string> TechStack { get; set; } = new();
    public List<string> Features { get; set; } = new();
    public List<ProjectMedia> Media { get; set; } = new();
    public string? GithubLink { get; set; }
    public string? LiveDemoLink { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>Raw DB row (JSON stored as strings) — internal to the repository.</summary>
internal class ProjectRow
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Description { get; set; } = "";
    public string TechStackJson { get; set; } = "[]";
    public string FeaturesJson { get; set; } = "[]";
    public string MediaJson { get; set; } = "[]";
    public string? GithubLink { get; set; }
    public string? LiveDemoLink { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
