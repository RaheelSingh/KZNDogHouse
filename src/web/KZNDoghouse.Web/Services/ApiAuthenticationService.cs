using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using Supabase.Gotrue.Exceptions;

namespace KZNDoghouse.Web.Services;

public interface IApiAuthenticationService
{
    Task<UserProfile?> AuthenticateAsync(string? authorizationHeader);
}

public class ApiAuthenticationService : IApiAuthenticationService
{
    private const string BearerPrefix = "Bearer ";

    private readonly ISupabaseClientFactory _supabaseClientFactory;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly ILogger<ApiAuthenticationService> _logger;

    public ApiAuthenticationService(
        ISupabaseClientFactory supabaseClientFactory,
        IUserProfileRepository userProfileRepository,
        ILogger<ApiAuthenticationService> logger)
    {
        _supabaseClientFactory = supabaseClientFactory;
        _userProfileRepository = userProfileRepository;
        _logger = logger;
    }

    public async Task<UserProfile?> AuthenticateAsync(
        string? authorizationHeader)
    {
        if (string.IsNullOrWhiteSpace(authorizationHeader)
            || !authorizationHeader.StartsWith(
                BearerPrefix,
                StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var token = authorizationHeader[BearerPrefix.Length..].Trim();

        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        try
        {
            var client =
                await _supabaseClientFactory.CreateAnonClientAsync();

            var supabaseUser =
                await client.Auth.GetUser(token);

            if (supabaseUser == null
                || string.IsNullOrWhiteSpace(supabaseUser.Id))
            {
                return null;
            }

            var profile =
                await _userProfileRepository
                    .GetByAuthUserIdAsync(supabaseUser.Id);

            return profile?.IsActive == true
                ? profile
                : null;
        }
        catch (GotrueException)
        {
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Bearer token validation failed because the authentication service was unavailable.");

            return null;
        }
    }
}
