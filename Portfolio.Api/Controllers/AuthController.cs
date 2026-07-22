using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portfolio.Api.Models;
using Portfolio.Api.Repositories;
using Portfolio.Api.Security;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAdminRepository _admins;
    private readonly TokenService _tokens;

    public AuthController(IAdminRepository admins, TokenService tokens)
    {
        _admins = admins;
        _tokens = tokens;
    }

    /// <summary>Owner login. Returns a JWT on success.</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _admins.GetByUsernameAsync(req.Username ?? string.Empty);
        if (user is null || !PasswordHasher.Verify(req.Password ?? string.Empty, user.PasswordHash))
            return Unauthorized(new { message = "Invalid username or password." });

        var (token, expiresAt) = _tokens.CreateToken(user.Username);
        return Ok(new LoginResponse { Token = token, Username = user.Username, ExpiresAt = expiresAt });
    }

    /// <summary>Validates the current token (used by the frontend to restore admin state).</summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me() => Ok(new { username = User.Identity?.Name, isAdmin = true });
}
