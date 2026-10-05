using System.Text.Json;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Repositories;
using Supabase.Gotrue;
using Supabase.Gotrue.Exceptions;

namespace KZNDoghouse.Web.Services;

public interface IAuthService
{
    Task<AuthSignInResult> SignInAsync(
        string email,
        string password);

    Task<RegistrationResult> RegisterPublicAsync(
        string firstName,
        string lastName,
        string email,
        string password,
        bool wantsToVolunteer);
}

public enum AuthSignInStatus
{
    Success,
    InvalidCredentials,
    InactiveAccount,
    AccountUnavailable,
    RateLimited,
    ServiceUnavailable
}

public enum RegistrationStatus
{
    Success,
    RateLimited,
    ServiceUnavailable,
    Failed
}

public record AuthLoginResult(
    string UserId,
    string Email,
    string DisplayName,
    string Role);

public record AuthSignInResult(
    AuthSignInStatus Status,
    AuthLoginResult? Account = null);

public record RegistrationResult(
    RegistrationStatus Status);

public class AuthService : IAuthService
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly INotificationService _notificationService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        ISupabaseClientFactory supabaseClientFactory,
        IUserProfileRepository userProfileRepository,
        INotificationService notificationService,
        ILogger<AuthService> logger)
    {
        _supabaseClientFactory = supabaseClientFactory;
        _userProfileRepository = userProfileRepository;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<AuthSignInResult> SignInAsync(
        string email,
        string password)
    {
        try
        {
            var client =
                await _supabaseClientFactory.CreateAnonClientAsync();

            var session =
                await client.Auth.SignIn(
                    email.Trim(),
                    password);

            if (session?.User == null
                || string.IsNullOrWhiteSpace(session.User.Id))
            {
                return new AuthSignInResult(
                    AuthSignInStatus.InvalidCredentials);
            }

            var profile =
                await _userProfileRepository
                    .GetByAuthUserIdAsync(session.User.Id);

            if (profile == null)
            {
                _logger.LogWarning(
                    "Authenticated Supabase user {UserId} has no application profile.",
                    session.User.Id);

                return new AuthSignInResult(
                    AuthSignInStatus.AccountUnavailable);
            }

            if (!profile.IsActive)
            {
                return new AuthSignInResult(
                    AuthSignInStatus.InactiveAccount);
            }

            var account = new AuthLoginResult(
                session.User.Id,
                session.User.Email ?? email.Trim(),
                profile.FullName,
                profile.Role);

            return new AuthSignInResult(
                AuthSignInStatus.Success,
                account);
        }
        catch (GotrueException ex)
        {
            var statusCode =
                TryGetSupabaseStatusCode(ex.Message);

            if (statusCode == 429
                || ex.Message.Contains(
                    "rate limit",
                    StringComparison.OrdinalIgnoreCase))
            {
                return new AuthSignInResult(
                    AuthSignInStatus.RateLimited);
            }

            if (statusCode >= 500)
            {
                _logger.LogWarning(
                    ex,
                    "Supabase authentication service returned a server error.");

                return new AuthSignInResult(
                    AuthSignInStatus.ServiceUnavailable);
            }

            return new AuthSignInResult(
                AuthSignInStatus.InvalidCredentials);
        }
        catch (Exception ex) when (
            ex is HttpRequestException
            || ex is TaskCanceledException)
        {
            _logger.LogWarning(
                ex,
                "The authentication service could not be reached.");

            return new AuthSignInResult(
                AuthSignInStatus.ServiceUnavailable);
        }
    }

    public async Task<RegistrationResult> RegisterPublicAsync(
        string firstName,
        string lastName,
        string email,
        string password,
        bool wantsToVolunteer)
    {
        try
        {
            var client =
                await _supabaseClientFactory.CreateAnonClientAsync();

            var options = new SignUpOptions
            {
                Data = new Dictionary<string, object>
                {
                    { "first_name", firstName.Trim() },
                    { "last_name", lastName.Trim() },
                    { "volunteer_interest", wantsToVolunteer }
                }
            };

            var session = await client.Auth.SignUp(
                email.Trim(),
                password,
                options);

            if (session?.User == null)
            {
                return new RegistrationResult(
                    RegistrationStatus.Failed);
            }

            if (wantsToVolunteer)
            {
                try
                {
                    await _notificationService.NotifyActiveRoleAsync(
                        UserRoles.Administrator,
                        NotificationCategories.General,
                        "New volunteer request",
                        $"{firstName.Trim()} {lastName.Trim()} has requested volunteer access.");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(
                        ex,
                        "Account {UserId} was created but the volunteer request notification could not be sent.",
                        session.User.Id);
                }
            }

            return new RegistrationResult(
                RegistrationStatus.Success);
        }
        catch (GotrueException ex)
        {
            var statusCode =
                TryGetSupabaseStatusCode(ex.Message);

            if (statusCode == 429
                || ex.Message.Contains(
                    "rate limit",
                    StringComparison.OrdinalIgnoreCase))
            {
                return new RegistrationResult(
                    RegistrationStatus.RateLimited);
            }

            if (statusCode >= 500)
            {
                _logger.LogWarning(
                    ex,
                    "Supabase registration service returned a server error.");

                return new RegistrationResult(
                    RegistrationStatus.ServiceUnavailable);
            }

            _logger.LogInformation(
                "A registration request was rejected by the authentication provider.");

            return new RegistrationResult(
                RegistrationStatus.Failed);
        }
        catch (Exception ex) when (
            ex is HttpRequestException
            || ex is TaskCanceledException)
        {
            _logger.LogWarning(
                ex,
                "The registration service could not be reached.");

            return new RegistrationResult(
                RegistrationStatus.ServiceUnavailable);
        }
    }

    private static int? TryGetSupabaseStatusCode(
        string message)
    {
        try
        {
            using var document =
                JsonDocument.Parse(message);

            if (document.RootElement.TryGetProperty(
                    "code",
                    out var code)
                && code.TryGetInt32(out var statusCode))
            {
                return statusCode;
            }
        }
        catch (JsonException)
        {
        }

        return null;
    }
}
