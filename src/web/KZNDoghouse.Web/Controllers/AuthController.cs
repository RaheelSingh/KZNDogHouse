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
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

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
}
