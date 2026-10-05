using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.DTOs;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace KZNDoghouse.Web.Controllers;

[ApiController]
[Route("api")]
public class ApiController : ControllerBase
{
    private readonly IApiAuthenticationService _apiAuthenticationService;

    public ApiController(
        IApiAuthenticationService apiAuthenticationService)
    {
        _apiAuthenticationService = apiAuthenticationService;
    }

    [AllowAnonymous]
    [HttpGet("health")]
    public ActionResult<ApiResponse<object>> Health()
    {
        var data = new
        {
            Status = "Healthy",
            Application = "KZN Doghouse API",
            Timestamp = DateTime.UtcNow
        };

        return Ok(
            ApiResponse<object>.Ok(
                data,
                "API is available."));
    }

    [AllowAnonymous]
    [HttpGet("me")]
    [EnableRateLimiting(RateLimitPolicies.Api)]
    public async Task<ActionResult<ApiResponse<MeResponseDto>>> Me()
    {
        var profile = await _apiAuthenticationService.AuthenticateAsync(
            Request.Headers.Authorization.ToString());

        if (profile == null)
        {
            return Unauthorized(
                ApiResponse<MeResponseDto>.Fail(
                    "Invalid, expired or inactive account token."));
        }

        var dto = new MeResponseDto
        {
            Id = profile.Id.ToString(),
            Name = profile.FullName,
            Email = profile.Email,
            Role = profile.Role
        };

        return Ok(ApiResponse<MeResponseDto>.Ok(dto));
    }
}
