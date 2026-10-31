using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace KZNDoghouse.Web.Controllers;

[ResponseCache(
    NoStore = true,
    Location = ResponseCacheLocation.None)]
public class AuthController : Controller
{
    private const string ResetEmailKey = "PasswordResetEmail";
    private const string ResetInfoKey = "PasswordResetInfo";
    private const string ResetTicketKey = "PasswordResetTicket";
    private const string ResetSuccessKey = "PasswordResetMessage";

    private readonly IAuthService _authService;
    private readonly IPasswordResetStateService _passwordResetState;

    public AuthController(
        IAuthService authService,
        IPasswordResetStateService passwordResetState)
    {
        _authService = authService;
        _passwordResetState = passwordResetState;
    }

    // Portal pages use this to detect role changes without waiting for a click.
    // The cookie is revalidated against the current database profile first.
    [Authorize]
    [HttpGet]
    public IActionResult SessionStatus() => Ok(new { authorised = true });

    [AllowAnonymous]
    [HttpGet]
    public IActionResult Login(
        string? returnUrl = null,
        bool rateLimited = false)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        if (rateLimited)
        {
            ViewData["RateLimitMessage"] =
                "Too many sign-in attempts. Please wait a few minutes before trying again.";
        }

        return View(new LoginViewModel
        {
            ReturnUrl = returnUrl
        });
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting(RateLimitPolicies.Login)]
    public async Task<IActionResult> Login(
        LoginViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var result =
            await _authService.SignInAsync(
                model.Email,
                model.Password);

        if (result.Status != AuthSignInStatus.Success
            || result.Account == null)
        {
            ModelState.AddModelError(
                string.Empty,
                GetSignInErrorMessage(
                    result.Status));

            return View(model);
        }

        var account = result.Account;

        var claims = new List<Claim>
        {
            new(
                ClaimTypes.NameIdentifier,
                account.UserId),

            new(
                ClaimTypes.Email,
                account.Email),

            new(
                ClaimTypes.Name,
                account.DisplayName),

            new(
                ClaimTypes.Role,
                account.Role)
        };

        var identity = new ClaimsIdentity(
            claims,
            CookieAuthenticationDefaults.AuthenticationScheme);

        var principal =
            new ClaimsPrincipal(identity);

        var properties = new AuthenticationProperties
        {
            IsPersistent = model.RememberMe,
            AllowRefresh = true
        };

        properties.Items[AuthCookieEvents.LastValidatedKey] =
            DateTimeOffset.UtcNow
                .ToUnixTimeSeconds()
                .ToString();

        if (model.RememberMe)
        {
            properties.ExpiresUtc =
                DateTimeOffset.UtcNow.AddDays(7);
        }

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            properties);

        if (!string.IsNullOrWhiteSpace(model.ReturnUrl)
            && Url.IsLocalUrl(model.ReturnUrl))
        {
            return LocalRedirect(model.ReturnUrl);
        }

        if (account.Role == UserRoles.Staff
            || account.Role == UserRoles.Administrator)
        {
            return RedirectToAction(
                "Index",
                "Portal");
        }

        if (account.Role == UserRoles.Vet)
        {
            return RedirectToAction(
                "Index",
                "VetDogs");
        }

        return RedirectToAction(
            "Index",
            "Home");
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult Register(
        bool volunteer = false,
        bool rateLimited = false)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        if (rateLimited)
        {
            ViewData["RateLimitMessage"] =
                "Too many account-creation attempts. Please wait a few minutes before trying again.";
        }

        return View(new RegisterViewModel
        {
            WantsToVolunteer = volunteer
        });
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting(RateLimitPolicies.Register)]
    public async Task<IActionResult> Register(
        RegisterViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var result =
            await _authService.RegisterPublicAsync(
                model.FirstName,
                model.LastName,
                model.Email,
                model.Password,
                model.WantsToVolunteer);

        if (result.Status != RegistrationStatus.Success)
        {
            ModelState.AddModelError(
                string.Empty,
                GetRegistrationErrorMessage(
                    result.Status));

            return View(model);
        }

        TempData["RegistrationMessage"] =
            model.WantsToVolunteer
                ? "Your Public account has been created and your volunteer request has been sent for administrator review. You can sign in while the request is pending."
                : "Your account has been created. You can now sign in.";

        return RedirectToAction(nameof(Login));
    }

    // ---------------------------------------------------------------
    // Forgot password - step 1: ask for the email address
    // ---------------------------------------------------------------

    [AllowAnonymous]
    [HttpGet]
    public IActionResult ForgotPassword(
        bool rateLimited = false)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        if (rateLimited)
        {
            ViewData["RateLimitMessage"] =
                "Too many password reset attempts. Please wait a few minutes before trying again.";
        }

        return View(new ForgotPasswordViewModel());
    }

    // Also used by the "Resend code" button on the ResetCode page.
    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting(RateLimitPolicies.PasswordReset)]
    public async Task<IActionResult> ForgotPassword(
        ForgotPasswordViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var email = model.Email.Trim();

        // Rule: one email per address every 5 minutes.
        if (!_passwordResetState.TryStartCooldown(
                email,
                out var remaining))
        {
            TempData[ResetEmailKey] = email;
            TempData[ResetInfoKey] =
                $"A code was already sent to this address. You can request a new one in {FormatCountdown(remaining)}.";

            return RedirectToAction(nameof(ResetCode));
        }

        var status =
            await _authService.RequestPasswordResetAsync(email);

        if (status is PasswordResetRequestStatus.RateLimited
            or PasswordResetRequestStatus.ServiceUnavailable)
        {
            // Nothing was sent, so let the user try again straight away.
            _passwordResetState.ClearCooldown(email);

            ModelState.AddModelError(
                string.Empty,
                status == PasswordResetRequestStatus.RateLimited
                    ? "We're sending a lot of emails right now. Please try again in a few minutes."
                    : "Password reset is temporarily unavailable. Please try again shortly.");

            return View(model);
        }

        // Sent and AlreadySent show the same message, so nobody can tell
        // whether an account exists for this email.
        TempData[ResetEmailKey] = email;
        TempData[ResetInfoKey] =
            "If an account exists for this email, we've sent it a verification code. It can take a minute to arrive, so check your spam folder too.";

        return RedirectToAction(nameof(ResetCode));
    }

    // ---------------------------------------------------------------
    // Forgot password - step 2: enter the code from the email
    // ---------------------------------------------------------------

    [AllowAnonymous]
    [HttpGet]
    public IActionResult ResetCode(
        bool rateLimited = false)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        if (rateLimited)
        {
            ViewData["RateLimitMessage"] =
                "Too many attempts. Please wait a few minutes before trying again.";
        }

        var email =
            TempData[ResetEmailKey] as string
            ?? string.Empty;

        return View(new ResetCodeViewModel
        {
            Email = email,
            ResendAvailableInSeconds = GetCooldownSeconds(email)
        });
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting(RateLimitPolicies.PasswordReset)]
    public async Task<IActionResult> ResetCode(
        ResetCodeViewModel model)
    {
        model.ResendAvailableInSeconds =
            GetCooldownSeconds(model.Email);

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var email = model.Email.Trim();

        var result =
            await _authService.VerifyPasswordResetCodeAsync(
                email,
                model.Code.Trim());

        if (result.Status != ResetCodeStatus.Verified
            || string.IsNullOrWhiteSpace(result.AccessToken)
            || string.IsNullOrWhiteSpace(result.RefreshToken))
        {
            ModelState.AddModelError(
                string.Empty,
                GetResetCodeErrorMessage(result.Status));

            // Clear the wrong code so the box is empty again.
            ModelState.Remove(nameof(ResetCodeViewModel.Code));
            model.Code = string.Empty;

            return View(model);
        }

        var ticket =
            _passwordResetState.CreateTicket(
                email,
                result.AccessToken,
                result.RefreshToken);

        TempData[ResetTicketKey] = ticket;

        return RedirectToAction(nameof(NewPassword));
    }

    // ---------------------------------------------------------------
    // Forgot password - step 3: choose a new password
    // ---------------------------------------------------------------

    [AllowAnonymous]
    [HttpGet]
    public IActionResult NewPassword()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        var ticket = TempData[ResetTicketKey] as string;

        if (_passwordResetState.GetTicket(ticket) == null)
        {
            return RedirectToResetExpired();
        }

        return View(new NewPasswordViewModel
        {
            Ticket = ticket!
        });
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> NewPassword(
        NewPasswordViewModel model)
    {
        var ticket =
            _passwordResetState.GetTicket(model.Ticket);

        if (ticket == null)
        {
            return RedirectToResetExpired();
        }

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var status =
            await _authService.UpdatePasswordAsync(
                ticket.AccessToken,
                ticket.RefreshToken,
                model.NewPassword);

        if (status == PasswordUpdateStatus.Updated)
        {
            _passwordResetState.RemoveTicket(model.Ticket);

            TempData[ResetSuccessKey] =
                "Your password has been changed. Please sign in with your new password.";

            return RedirectToAction(nameof(Login));
        }

        if (status == PasswordUpdateStatus.SessionExpired)
        {
            _passwordResetState.RemoveTicket(model.Ticket);

            return RedirectToResetExpired();
        }

        ModelState.AddModelError(
            string.Empty,
            GetPasswordUpdateErrorMessage(status));

        return View(model);
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult AccessDenied()
    {
        return View();
    }

    [Authorize]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(
            CookieAuthenticationDefaults.AuthenticationScheme);

        return RedirectToAction(
            "Index",
            "Home");
    }

    private IActionResult RedirectToResetExpired()
    {
        TempData[ResetInfoKey] =
            "Your verification has expired. Please request a new code.";

        return RedirectToAction(nameof(ForgotPassword));
    }

    private int GetCooldownSeconds(
        string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return 0;
        }

        var remaining =
            _passwordResetState.GetCooldownRemaining(email);

        return (int)Math.Ceiling(remaining.TotalSeconds);
    }

    private static string FormatCountdown(
        TimeSpan remaining)
    {
        var totalSeconds =
            Math.Max(0, (int)Math.Ceiling(remaining.TotalSeconds));

        return $"{totalSeconds / 60}:{totalSeconds % 60:00}";
    }

    private static string GetSignInErrorMessage(
        AuthSignInStatus status)
    {
        return status switch
        {
            AuthSignInStatus.InactiveAccount =>
                "This account is currently inactive. Contact KZN Doghouse if you believe this is a mistake.",

            AuthSignInStatus.RateLimited =>
                "Too many sign-in attempts. Please wait a few minutes before trying again.",

            AuthSignInStatus.ServiceUnavailable =>
                "Sign-in is temporarily unavailable. Please try again shortly.",

            AuthSignInStatus.AccountUnavailable =>
                "Unable to sign in with this account.",

            _ =>
                "Incorrect email or password."
        };
    }

    private static string GetRegistrationErrorMessage(
        RegistrationStatus status)
    {
        return status switch
        {
            RegistrationStatus.RateLimited =>
                "Too many account-creation attempts. Please wait a few minutes before trying again.",

            RegistrationStatus.ServiceUnavailable =>
                "Account creation is temporarily unavailable. Please try again shortly.",

            _ =>
                "Unable to create the account. Please check your details or try another email address."
        };
    }

    private static string GetResetCodeErrorMessage(
        ResetCodeStatus status)
    {
        return status switch
        {
            ResetCodeStatus.RateLimited =>
                "Too many attempts. Please wait a few minutes before trying again.",

            ResetCodeStatus.ServiceUnavailable =>
                "Verification is temporarily unavailable. Please try again shortly.",

            _ =>
                "That code is incorrect or has expired. Check the latest email we sent you, or request a new code."
        };
    }

    private static string GetPasswordUpdateErrorMessage(
        PasswordUpdateStatus status)
    {
        return status switch
        {
            PasswordUpdateStatus.SamePassword =>
                "Your new password must be different from your old password.",

            PasswordUpdateStatus.WeakPassword =>
                "That password was rejected. Please choose a stronger password.",

            PasswordUpdateStatus.RateLimited =>
                "Too many attempts. Please wait a few minutes before trying again.",

            PasswordUpdateStatus.ServiceUnavailable =>
                "Password changes are temporarily unavailable. Please try again shortly.",

            _ =>
                "We couldn't change your password. Please try again."
        };
    }
}
