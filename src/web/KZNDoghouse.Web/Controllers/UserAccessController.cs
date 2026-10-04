using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
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
        var currentAuthUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(currentAuthUserId))
        {
            return Challenge();
        }

        var usersTask =
            _userService.GetAllUsersAsync(
                currentAuthUserId);

        var pendingRequestsTask =
            _userService.GetPendingVolunteerRequestsAsync();

        await Task.WhenAll(
            usersTask,
            pendingRequestsTask);

        var model = new UserAccessViewModel
        {
            Users = await usersTask,
            PendingVolunteerRequests =
                await pendingRequestsTask,
            CurrentAuthUserId = currentAuthUserId
        };

        return View(model);
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

        SetResultMessage(result);

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ApproveVolunteer(
        Guid profileId)
    {
        return await ReviewVolunteerRequest(
            profileId,
            true);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RejectVolunteer(
        Guid profileId)
    {
        return await ReviewVolunteerRequest(
            profileId,
            false);
    }

    private async Task<IActionResult> ReviewVolunteerRequest(
        Guid profileId,
        bool approve)
    {
        var currentAuthUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(currentAuthUserId))
        {
            return Challenge();
        }

        var result =
            await _userService.ReviewVolunteerRequestAsync(
                profileId,
                approve,
                currentAuthUserId);

        SetResultMessage(result);

        return RedirectToAction(nameof(Index));
    }

    private void SetResultMessage(
        UserAccessUpdateResult result)
    {
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
    }
}
