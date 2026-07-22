using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portfolio.Api.Models;
using Portfolio.Api.Repositories;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/content")]
public class ContentController : ControllerBase
{
    private readonly IContentRepository _repo;

    /// <summary>Whitelisted section keys — anything else is rejected.</summary>
    public static readonly HashSet<string> Sections = new(StringComparer.OrdinalIgnoreCase)
    {
        "profile", "skills", "experience", "education", "stats", "achievements", "certifications"
    };

    public ContentController(IContentRepository repo) => _repo = repo;

    // ---- public reads ----

    [HttpGet("{section}")]
    public async Task<IActionResult> GetSection(string section)
    {
        if (!Sections.Contains(section)) return NotFound(new { message = "Unknown section." });
        return Ok(await _repo.GetSectionAsync(section));
    }

    [HttpGet("{section}/{id:int}")]
    public async Task<IActionResult> GetItem(string section, int id)
    {
        if (!Sections.Contains(section)) return NotFound(new { message = "Unknown section." });
        var item = await _repo.GetItemAsync(section, id);
        return item is null ? NotFound(new { message = "Item not found." }) : Ok(item);
    }

    // ---- admin-only writes ----

    [HttpPost("{section}")]
    [Authorize]
    public async Task<IActionResult> Create(string section, [FromBody] ContentWriteDto dto)
    {
        if (!Sections.Contains(section)) return NotFound(new { message = "Unknown section." });
        var created = await _repo.CreateAsync(section, dto);
        return CreatedAtAction(nameof(GetItem), new { section, id = created.Id }, created);
    }

    [HttpPut("{section}/{id:int}")]
    [Authorize]
    public async Task<IActionResult> Update(string section, int id, [FromBody] ContentWriteDto dto)
    {
        if (!Sections.Contains(section)) return NotFound(new { message = "Unknown section." });
        var ok = await _repo.UpdateAsync(section, id, dto);
        if (!ok) return NotFound(new { message = "Item not found." });
        return Ok(await _repo.GetItemAsync(section, id));
    }

    [HttpDelete("{section}/{id:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(string section, int id)
    {
        if (!Sections.Contains(section)) return NotFound(new { message = "Unknown section." });
        var ok = await _repo.DeleteAsync(section, id);
        return ok ? NoContent() : NotFound(new { message = "Item not found." });
    }
}
