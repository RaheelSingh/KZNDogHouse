using System.Security.Claims;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public class AvailabilityController : Controller
{
    private readonly IAvailabilityService _availabilityService;
    private readonly IUserProfileRepository _userProfileRepository;

    public AvailabilityController(
        IAvailabilityService availabilityService,
        IUserProfileRepository userProfileRepository)
    {
        _availabilityService = availabilityService;
        _userProfileRepository = userProfileRepository;
    }

[HttpGet]
public async Task<IActionResult> Index()
{
    var pending = await _availabilityService.GetPendingAsync();

    var items = new List<AvailabilitySlotListItem>();

    foreach (var slot in pending)
    {
        var volunteerProfile =
            await _userProfileRepository.GetByIdAsync(slot.VolunteerId);

        items.Add(new AvailabilitySlotListItem
        {
            Slot = slot,
            VolunteerName = volunteerProfile?.FullName ?? "Unknown volunteer"
        });
    }

    return View(items);
}

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Approve(Guid id)
    {
        var profile = await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        await _availabilityService.ApproveAsync(id, profile.Id);

        TempData["SuccessMessage"] = "Availability approved.";

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Reject(Guid id)
    {
        var profile = await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        await _availabilityService.RejectAsync(id, profile.Id);

        TempData["SuccessMessage"] = "Availability rejected.";

        return RedirectToAction(nameof(Index));
    }

    private async Task<UserProfile?> GetCurrentProfileAsync()
    {
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authId))
        {
            return null;
        }

        return await _userProfileRepository.GetByAuthUserIdAsync(authId);
    }
}