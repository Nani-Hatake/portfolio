using Portfolio.Api.Models;

namespace Portfolio.Api.Repositories;

public interface IContentRepository
{
    Task<IEnumerable<ContentItemDto>> GetSectionAsync(string section);
    Task<ContentItemDto?> GetItemAsync(string section, int id);
    Task<ContentItemDto> CreateAsync(string section, ContentWriteDto dto);
    Task<bool> UpdateAsync(string section, int id, ContentWriteDto dto);
    Task<bool> DeleteAsync(string section, int id);
    Task<int> CountAsync(string section);
}
