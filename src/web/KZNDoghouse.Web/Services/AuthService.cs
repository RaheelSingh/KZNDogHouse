using KZNDoghouse.Web.Repositories;
using Supabase.Gotrue.Exceptions;

namespace KZNDoghouse.Web.Services;

public interface IAuthService
{
    Task<AuthLoginResult?> SignInAsync(
        string email,
        string password);
}

public record AuthLoginResult(
    string UserId,
    string Email,
    string DisplayName,
    string Role);

public class AuthService : IAuthService
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;
    private readonly IUserProfileRepository _userProfileRepository;

    public AuthService(
        ISupabaseClientFactory supabaseClientFactory,
        IUserProfileRepository userProfileRepository)
    {
        _supabaseClientFactory = supabaseClientFactory;
        _userProfileRepository = userProfileRepository;
    }

    public async Task<AuthLoginResult?> SignInAsync(
        string email,
        string password)
    {
        try
        {
            var client =
                await _supabaseClientFactory.CreateAnonClientAsync();

            var session =
                await client.Auth.SignIn(email, password);

            if (session?.User == null)
            {
                return null;
            }

            var userId = session.User.Id;

            if (string.IsNullOrWhiteSpace(userId))
            {
                return null;
            }

            var profile =
                await _userProfileRepository
                    .GetByAuthUserIdAsync(userId);

            if (profile == null || !profile.IsActive)
            {
                return null;
            }

            return new AuthLoginResult(
                userId,
                session.User.Email ?? email,
                profile.FullName,
                profile.Role);
        }
        catch (GotrueException)
        {
            return null;
        }
    }
}