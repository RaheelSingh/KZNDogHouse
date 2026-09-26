using KZNDoghouse.Web.DTOs;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Supabase.Gotrue.Exceptions;

namespace KZNDoghouse.Web.Controllers;

[ApiController]
[Route("api")]
public class ApiController : ControllerBase
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;
    private readonly IUserProfileRepository _userProfileRepository;

    public ApiController(
        ISupabaseClientFactory supabaseClientFactory,
        IUserProfileRepository userProfileRepository)
    {
        _supabaseClientFactory = supabaseClientFactory;
        _userProfileRepository = userProfileRepository;
    }

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
    public async Task<ActionResult<ApiResponse<MeResponseDto>>> Me()
    {
        var authHeader = Request.Headers.Authorization.ToString();

        if (string.IsNullOrWhiteSpace(authHeader)
            || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(
                ApiResponse<MeResponseDto>.Fail(
                    "Missing or invalid Authorization header."));
        }

        var token = authHeader["Bearer ".Length..].Trim();

        try
        {
            var client =
                await _supabaseClientFactory.CreateAnonClientAsync();

            var supabaseUser =
                await client.Auth.GetUser(token);

            if (supabaseUser == null
                || string.IsNullOrWhiteSpace(supabaseUser.Id))
            {
                return Unauthorized(
                    ApiResponse<MeResponseDto>.Fail(
                        "Invalid or expired token."));
            }

            var profile =
                await _userProfileRepository
                    .GetByAuthUserIdAsync(supabaseUser.Id);

            if (profile == null || !profile.IsActive)
            {
                return Unauthorized(
                    ApiResponse<MeResponseDto>.Fail(
                        "Account not found or inactive."));
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
        catch (GotrueException)
        {
            return Unauthorized(
                ApiResponse<MeResponseDto>.Fail(
                    "Invalid or expired token."));
        }
    }
}