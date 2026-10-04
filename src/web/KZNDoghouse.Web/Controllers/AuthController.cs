using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

public class AuthController : Controller
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        return View(new LoginViewModel
        {
            ReturnUrl = returnUrl
        });
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var result = await _authService.SignInAsync(
            model.Email,
            model.Password);

        if (result == null)
        {
            ModelState.AddModelError(
                string.Empty,
                "Unable to sign in with this account.");

            return View(model);
        }

        var claims = new List<Claim>
        {
            new(
                ClaimTypes.NameIdentifier,
                result.UserId),

            new(
                ClaimTypes.Email,
                result.Email),

            new(
                ClaimTypes.Name,
                result.DisplayName),

            new(
                ClaimTypes.Role,
                result.Role)
        };

        var identity = new ClaimsIdentity(
            claims,
            CookieAuthenticationDefaults.AuthenticationScheme);

        var principal =
            new ClaimsPrincipal(identity);

        var properties = new AuthenticationProperties
        {
            IsPersistent = model.RememberMe
        };

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            properties);

        if (!string.IsNullOrWhiteSpace(model.ReturnUrl)
            && Url.IsLocalUrl(model.ReturnUrl))
        {
            return LocalRedirect(model.ReturnUrl);
        }

        if (result.Role == UserRoles.Staff
            || result.Role == UserRoles.Administrator)
        {
            return RedirectToAction(
                "Index",
                "Portal");
        }

        return RedirectToAction(
            "Index",
            "Home");
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult Register(bool volunteer = false)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        return View(new RegisterViewModel
        {
            WantsToVolunteer = volunteer
        });
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(
        RegisterViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var success =
            await _authService.RegisterPublicAsync(
                model.FirstName,
                model.LastName,
                model.Email,
                model.Password,
                model.WantsToVolunteer);

        if (!success)
        {
            ModelState.AddModelError(
                string.Empty,
                "Unable to create the account. Please check your details and try again.");

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
}
