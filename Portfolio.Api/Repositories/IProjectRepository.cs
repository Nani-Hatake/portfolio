using Portfolio.Api.Models;

namespace Portfolio.Api.Repositories;

public interface IProjectRepository
{
    Task<IEnumerable<ProjectDto>> GetAllAsync();
    Task<ProjectDto?> GetByIdAsync(int id);
    Task<ProjectDto> CreateAsync(ProjectWriteDto dto);
    Task<bool> UpdateAsync(int id, ProjectWriteDto dto);
    Task<bool> DeleteAsync(int id);
    Task<int> CountAsync();
}
