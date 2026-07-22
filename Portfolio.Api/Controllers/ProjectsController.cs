using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portfolio.Api.Models;
using Portfolio.Api.Repositories;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectRepository _repo;

    public ProjectsController(IProjectRepository repo) => _repo = repo;

    // ---- public reads ----

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _repo.GetAllAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var project = await _repo.GetByIdAsync(id);
        return project is null ? NotFound(new { message = "Project not found." }) : Ok(project);
    }

    // ---- admin-only writes ----

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] ProjectWriteDto dto)
    {
        var error = Validate(dto);
        if (error is not null) return BadRequest(new { message = error });

        var created = await _repo.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, [FromBody] ProjectWriteDto dto)
    {
        var error = Validate(dto);
        if (error is not null) return BadRequest(new { message = error });

        var ok = await _repo.UpdateAsync(id, dto);
        if (!ok) return NotFound(new { message = "Project not found." });

        return Ok(await _repo.GetByIdAsync(id));
    }

    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _repo.DeleteAsync(id);
        return ok ? NoContent() : NotFound(new { message = "Project not found." });
    }

    private static string? Validate(ProjectWriteDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title)) return "Title is required.";
        if (string.IsNullOrWhiteSpace(dto.Summary)) return "Summary is required.";
        return null;
    }
}
