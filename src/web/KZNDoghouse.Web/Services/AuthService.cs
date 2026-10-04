using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Repositories;
using Supabase.Gotrue;
using Supabase.Gotrue.Exceptions;

namespace KZNDoghouse.Web.Services;

public interface IAuthService
{
    Task<AuthLoginResult?> SignInAsync(
        string email,
        string password);

    Task<bool> RegisterPublicAsync(
        string firstName,
        string lastName,
        string email,
        string password,
        bool wantsToVolunteer);
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

    public async Task<bool> RegisterPublicAsync(
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
                return false;
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

            return true;
        }
        catch (GotrueException ex)
        {
            _logger.LogWarning(
                "Supabase registration failed: {Message}",
                ex.Message);

            return false;
        }
    }
}
