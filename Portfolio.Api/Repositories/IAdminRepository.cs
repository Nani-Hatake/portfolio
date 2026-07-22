using Portfolio.Api.Models;

namespace Portfolio.Api.Repositories;

public interface IAdminRepository
{
    Task<AdminUser?> GetByUsernameAsync(string username);
    Task<int> CreateAsync(string username, string passwordHash);
    Task UpdatePasswordAsync(string username, string passwordHash);
    Task DeleteOthersAsync(string keepUsername);
}
