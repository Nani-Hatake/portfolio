using Dapper;
using Portfolio.Api.Data;
using Portfolio.Api.Models;

namespace Portfolio.Api.Repositories;

public class AdminRepository : IAdminRepository
{
    private readonly ISqlConnectionFactory _factory;

    public AdminRepository(ISqlConnectionFactory factory) => _factory = factory;

    public async Task<AdminUser?> GetByUsernameAsync(string username)
    {
        using var db = _factory.Create();
        return await db.QuerySingleOrDefaultAsync<AdminUser>(
            "SELECT Id, Username, PasswordHash, CreatedAt FROM AdminUsers WHERE Username = @username;",
            new { username });
    }

    public async Task<int> CreateAsync(string username, string passwordHash)
    {
        using var db = _factory.Create();
        return await db.ExecuteScalarAsync<int>(@"
INSERT INTO AdminUsers (Username, PasswordHash)
VALUES (@username, @passwordHash)
RETURNING Id;",
            new { username, passwordHash });
    }

    public async Task UpdatePasswordAsync(string username, string passwordHash)
    {
        using var db = _factory.Create();
        await db.ExecuteAsync(
            "UPDATE AdminUsers SET PasswordHash = @passwordHash WHERE Username = @username;",
            new { username, passwordHash });
    }

    public async Task DeleteOthersAsync(string keepUsername)
    {
        using var db = _factory.Create();
        await db.ExecuteAsync(
            "DELETE FROM AdminUsers WHERE Username <> @keepUsername;",
            new { keepUsername });
    }
}
