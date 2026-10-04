using System.Security.Claims;
using KZNDoghouse.Web.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace KZNDoghouse.Web.Services;

public class AuthCookieEvents : CookieAuthenticationEvents
{
    public const string LastValidatedKey = "kzn:last-validated";

    private static readonly TimeSpan ValidationInterval =
        TimeSpan.FromMinutes(10);

    private readonly IUserProfileRepository _userProfileRepository;
    private readonly ILogger<AuthCookieEvents> _logger;

    public AuthCookieEvents(
        IUserProfileRepository userProfileRepository,
        ILogger<AuthCookieEvents> logger)
    {
        _userProfileRepository = userProfileRepository;
        _logger = logger;
    }

    public override async Task ValidatePrincipal(
        CookieValidatePrincipalContext context)
    {
        if (context.Principal?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;

        if (WasRecentlyValidated(
                context,
                now))
        {
            return;
        }

        var authUserId =
            context.Principal.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authUserId))
        {
            await RejectPrincipalAsync(context);
            return;
        }

        try
        {
            var profile =
                await _userProfileRepository
                    .GetByAuthUserIdAsync(authUserId);

            if (profile == null || !profile.IsActive)
            {
                await RejectPrincipalAsync(context);
                return;
            }

            var currentRole =
                context.Principal.FindFirstValue(
                    ClaimTypes.Role);

            var currentName =
                context.Principal.FindFirstValue(
                    ClaimTypes.Name);

            var currentEmail =
                context.Principal.FindFirstValue(
                    ClaimTypes.Email);

            if (!string.Equals(
                    currentRole,
                    profile.Role,
                    StringComparison.Ordinal)
                || !string.Equals(
                    currentName,
                    profile.FullName,
                    StringComparison.Ordinal)
                || !string.Equals(
                    currentEmail,
                    profile.Email,
                    StringComparison.OrdinalIgnoreCase))
            {
                var claims = new List<Claim>
                {
                    new(
                        ClaimTypes.NameIdentifier,
                        authUserId),

                    new(
                        ClaimTypes.Email,
                        profile.Email),

                    new(
                        ClaimTypes.Name,
                        profile.FullName),

                    new(
                        ClaimTypes.Role,
                        profile.Role)
                };

                var identity = new ClaimsIdentity(
                    claims,
                    CookieAuthenticationDefaults.AuthenticationScheme);

                context.ReplacePrincipal(
                    new ClaimsPrincipal(identity));
            }

            context.Properties.Items[LastValidatedKey] =
                now.ToUnixTimeSeconds().ToString();

            context.ShouldRenew = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "The signed-in account could not be revalidated. The existing session will be kept temporarily.");

            context.Properties.Items[LastValidatedKey] =
                now.ToUnixTimeSeconds().ToString();

            context.ShouldRenew = true;
        }
    }

    private static bool WasRecentlyValidated(
        CookieValidatePrincipalContext context,
        DateTimeOffset now)
    {
        if (!context.Properties.Items.TryGetValue(
                LastValidatedKey,
                out var value)
            || !long.TryParse(
                value,
                out var lastValidatedSeconds))
        {
            return false;
        }

        var lastValidated =
            DateTimeOffset.FromUnixTimeSeconds(
                lastValidatedSeconds);

        return now - lastValidated < ValidationInterval;
    }

    private static async Task RejectPrincipalAsync(
        CookieValidatePrincipalContext context)
    {
        context.RejectPrincipal();

        await context.HttpContext.SignOutAsync(
            CookieAuthenticationDefaults.AuthenticationScheme);
    }
}
