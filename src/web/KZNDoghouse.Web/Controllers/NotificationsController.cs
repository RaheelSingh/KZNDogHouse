using System.Security.Claims;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public class NotificationsController : Controller
{
    private readonly INotificationService _notificationService;
    private readonly IUserProfileRepository _userProfileRepository;

    public NotificationsController(
        INotificationService notificationService,
        IUserProfileRepository userProfileRepository)
    {
        _notificationService = notificationService;
        _userProfileRepository = userProfileRepository;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var profile =
            await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        var notifications =
            await _notificationService
                .GetRecentForRecipientAsync(profile.Id);

        await _notificationService
            .MarkAllAsReadAsync(profile.Id);

        return View(notifications);
    }

    [HttpGet]
    public async Task<IActionResult> UnreadCount()
    {
        var profile =
            await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Unauthorized();
        }

        var count =
            await _notificationService
                .GetUnreadCountAsync(profile.Id);

        return Json(new
        {
            count
        });
    }

    private async Task<UserProfile?> GetCurrentProfileAsync()
    {
        var authUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authUserId))
        {
            return null;
        }

        return await _userProfileRepository
            .GetByAuthUserIdAsync(authUserId);
    }
}
