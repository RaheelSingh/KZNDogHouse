using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = UserRoles.Administrator)]
public class UserAccessController : Controller
{
    private readonly IUserService _userService;

    public UserAccessController(
        IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var users =
            await _userService.GetAllUsersAsync();

        return View(users);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Update(
        Guid profileId,
        string role,
        bool isActive)
    {
        var currentAuthUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(currentAuthUserId))
        {
            return Challenge();
        }

        var result =
            await _userService.UpdateAccessAsync(
                profileId,
                role,
                isActive,
                currentAuthUserId);

        if (result.Success)
        {
            TempData["SuccessMessage"] =
                result.Message;
        }
        else
        {
            TempData["ErrorMessage"] =
                result.Message;
        }

        return RedirectToAction(nameof(Index));
    }
}