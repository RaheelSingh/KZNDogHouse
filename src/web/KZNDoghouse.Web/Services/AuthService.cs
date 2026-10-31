using System.Text.Json;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Repositories;
using Supabase.Gotrue;
using Supabase.Gotrue.Exceptions;
using static Supabase.Gotrue.Constants;

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

    Task<PasswordResetRequestStatus> RequestPasswordResetAsync(
        string email);

    Task<ResetCodeResult> VerifyPasswordResetCodeAsync(
        string email,
        string code);

    Task<PasswordUpdateStatus> UpdatePasswordAsync(
        string accessToken,
        string refreshToken,
        string newPassword);
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

public enum PasswordResetRequestStatus
{
    Sent,
    AlreadySent,
    RateLimited,
    ServiceUnavailable
}

public enum ResetCodeStatus
{
    Verified,
    InvalidOrExpired,
    RateLimited,
    ServiceUnavailable
}

public enum PasswordUpdateStatus
{
    Updated,
    SamePassword,
    WeakPassword,
    SessionExpired,
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

public record ResetCodeResult(
    ResetCodeStatus Status,
    string? AccessToken = null,
    string? RefreshToken = null);

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

    public async Task<PasswordResetRequestStatus> RequestPasswordResetAsync(
        string email)
    {
        try
        {
            var client =
                await _supabaseClientFactory.CreateAnonClientAsync();

            // Supabase answers "OK" even when no account uses this email,
            // so nobody can use this form to find out who has an account.
            await client.Auth.ResetPasswordForEmail(
                email.Trim().ToLowerInvariant());

            return PasswordResetRequestStatus.Sent;
        }
        catch (GotrueException ex)
        {
            var statusCode = GetStatusCode(ex);

            if (statusCode == 429)
            {
                // Supabase's own "Minimum interval per user" (300 seconds):
                // a code was already sent to this address very recently.
                if (ContainsText(ex, "For security purposes"))
                {
                    return PasswordResetRequestStatus.AlreadySent;
                }

                _logger.LogWarning(
                    "Supabase refused to send a password reset email because the project email rate limit was reached.");

                return PasswordResetRequestStatus.RateLimited;
            }

            if (ex.Reason == FailureHint.Reason.Offline
                || statusCode == 0
                || statusCode >= 500)
            {
                // A 500 here usually means the SMTP settings in Supabase are wrong.
                _logger.LogWarning(
                    ex,
                    "Supabase could not send a password reset email. Status {StatusCode}. Response: {Content}",
                    statusCode,
                    ex.Content);

                return PasswordResetRequestStatus.ServiceUnavailable;
            }

            // Any other rejection gets the same "if an account exists" message,
            // so nothing is revealed about the email address.
            _logger.LogInformation(
                "A password reset request was rejected by the authentication provider ({StatusCode}).",
                statusCode);

            return PasswordResetRequestStatus.Sent;
        }
        catch (Exception ex) when (
            ex is HttpRequestException
            || ex is TaskCanceledException)
        {
            _logger.LogWarning(
                ex,
                "The password reset service could not be reached.");

            return PasswordResetRequestStatus.ServiceUnavailable;
        }
    }

    public async Task<ResetCodeResult> VerifyPasswordResetCodeAsync(
        string email,
        string code)
    {
        try
        {
            var client =
                await _supabaseClientFactory.CreateAnonClientAsync();

            var session =
                await client.Auth.VerifyOTP(
                    email.Trim().ToLowerInvariant(),
                    code.Trim(),
                    EmailOtpType.Recovery);

            if (session?.User == null
                || string.IsNullOrWhiteSpace(session.AccessToken)
                || string.IsNullOrWhiteSpace(session.RefreshToken))
            {
                return new ResetCodeResult(
                    ResetCodeStatus.InvalidOrExpired);
            }

            return new ResetCodeResult(
                ResetCodeStatus.Verified,
                session.AccessToken,
                session.RefreshToken);
        }
        catch (GotrueException ex)
        {
            var statusCode = GetStatusCode(ex);

            if (statusCode == 429)
            {
                return new ResetCodeResult(
                    ResetCodeStatus.RateLimited);
            }

            if (ex.Reason == FailureHint.Reason.Offline
                || statusCode == 0
                || statusCode >= 500)
            {
                _logger.LogWarning(
                    ex,
                    "Supabase could not verify a password reset code. Status {StatusCode}.",
                    statusCode);

                return new ResetCodeResult(
                    ResetCodeStatus.ServiceUnavailable);
            }

            return new ResetCodeResult(
                ResetCodeStatus.InvalidOrExpired);
        }
        catch (Exception ex) when (
            ex is HttpRequestException
            || ex is TaskCanceledException)
        {
            _logger.LogWarning(
                ex,
                "The password reset service could not be reached.");

            return new ResetCodeResult(
                ResetCodeStatus.ServiceUnavailable);
        }
    }

    public async Task<PasswordUpdateStatus> UpdatePasswordAsync(
        string accessToken,
        string refreshToken,
        string newPassword)
    {
        try
        {
            var client =
                await _supabaseClientFactory.CreateAnonClientAsync();

            // Restore the session Supabase gave us when the code was verified.
            await client.Auth.SetSession(
                accessToken,
                refreshToken);

            var user =
                await client.Auth.Update(
                    new UserAttributes
                    {
                        Password = newPassword
                    });

            if (user == null)
            {
                return PasswordUpdateStatus.Failed;
            }

            await SignOutEverywhereAsync(client);

            return PasswordUpdateStatus.Updated;
        }
        catch (GotrueException ex)
        {
            var statusCode = GetStatusCode(ex);

            if (ContainsText(ex, "same_password")
                || ContainsText(ex, "different from the old password"))
            {
                return PasswordUpdateStatus.SamePassword;
            }

            if (ContainsText(ex, "weak_password"))
            {
                return PasswordUpdateStatus.WeakPassword;
            }

            if (statusCode == 429)
            {
                return PasswordUpdateStatus.RateLimited;
            }

            if (ex.Reason == FailureHint.Reason.Offline
                || statusCode >= 500)
            {
                _logger.LogWarning(
                    ex,
                    "Supabase could not update a password. Status {StatusCode}.",
                    statusCode);

                return PasswordUpdateStatus.ServiceUnavailable;
            }

            if (statusCode == 401
                || statusCode == 403
                || ex.Reason == FailureHint.Reason.NoSessionFound
                || ex.Reason == FailureHint.Reason.InvalidRefreshToken)
            {
                return PasswordUpdateStatus.SessionExpired;
            }

            if (statusCode == 422)
            {
                return PasswordUpdateStatus.WeakPassword;
            }

            _logger.LogWarning(
                ex,
                "A password update was rejected. Status {StatusCode}.",
                statusCode);

            return PasswordUpdateStatus.Failed;
        }
        catch (Exception ex) when (
            ex is HttpRequestException
            || ex is TaskCanceledException)
        {
            _logger.LogWarning(
                ex,
                "The password update service could not be reached.");

            return PasswordUpdateStatus.ServiceUnavailable;
        }
    }

    private async Task SignOutEverywhereAsync(
        Supabase.Client client)
    {
        try
        {
            // Global = every device and browser signed in to this account
            // (including the mobile app) must sign in again with the new password.
            await client.Auth.SignOut(SignOutScope.Global);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "The password was changed, but other sessions could not be signed out.");
        }
    }

    private static int GetStatusCode(
        GotrueException ex)
    {
        if (ex.StatusCode > 0)
        {
            return ex.StatusCode;
        }

        return TryGetSupabaseStatusCode(ex.Message) ?? 0;
    }

    private static bool ContainsText(
        GotrueException ex,
        string text)
    {
        var content = ex.Content ?? ex.Message ?? string.Empty;

        return content.Contains(
            text,
            StringComparison.OrdinalIgnoreCase);
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