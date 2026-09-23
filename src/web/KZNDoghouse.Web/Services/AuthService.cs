using Supabase.Gotrue.Exceptions;

namespace KZNDoghouse.Web.Services;

public interface IAuthService
{
    Task<AuthLoginResult?> SignInAsync(string email, string password);
}

public record AuthLoginResult(
    string UserId,
    string Email);

public class AuthService : IAuthService
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public AuthService(ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
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

            return new AuthLoginResult(
                userId,
                session.User.Email ?? email);
        }
        catch (GotrueException)
        {
            return null;
        }
    }
}