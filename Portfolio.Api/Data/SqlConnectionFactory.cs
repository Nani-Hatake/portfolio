using System.Data;
using Npgsql;

namespace Portfolio.Api.Data;

public interface ISqlConnectionFactory
{
    IDbConnection Create();
    string ConnectionString { get; }
}

/// <summary>Creates PostgreSQL connections for Dapper.</summary>
public class SqlConnectionFactory : ISqlConnectionFactory
{
    public string ConnectionString { get; }

    public SqlConnectionFactory(string connectionString) => ConnectionString = connectionString;

    public IDbConnection Create() => new NpgsqlConnection(ConnectionString);
}
