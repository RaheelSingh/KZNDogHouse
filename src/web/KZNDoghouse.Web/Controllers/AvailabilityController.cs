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
        var slotsTask =
            _availabilityService.GetAllAsync();

        var usersTask =
            _userProfileRepository.GetAllAsync();

        await Task.WhenAll(
            slotsTask,
            usersTask);

        var slots = await slotsTask;
        var users = await usersTask;

        var userNames = users
            .ToDictionary(
                x => x.Id,
                x => x.FullName);

        var items = slots
            .Select(slot => new AvailabilitySlotListItem
            {
                Slot = slot,
                VolunteerName = userNames.TryGetValue(
                    slot.VolunteerId,
                    out var name)
                        ? name
                        : "Unknown volunteer"
            })
            .ToList();

        return View(items);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Approve(Guid id)
    {
        var profile =
            await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        var slot =
            await FindPendingSlotAsync(id);

        if (slot == null)
        {
            TempData["ErrorMessage"] =
                "That submission could not be found.";

            return RedirectToAction(nameof(Index));
        }

        await _availabilityService
            .ApproveAsync(slot, profile.Id);

        TempData["SuccessMessage"] =
            "Availability approved.";

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Reject(Guid id)
    {
        var profile =
            await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        var slot =
            await FindPendingSlotAsync(id);

        if (slot == null)
        {
            TempData["ErrorMessage"] =
                "That submission could not be found.";

            return RedirectToAction(nameof(Index));
        }

        await _availabilityService
            .RejectAsync(slot, profile.Id);

        TempData["SuccessMessage"] =
            "Availability rejected.";

        return RedirectToAction(nameof(Index));
    }

    private async Task<UserProfile?> GetCurrentProfileAsync()
    {
        var authId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authId))
        {
            return null;
        }

        return await _userProfileRepository
            .GetByAuthUserIdAsync(authId);
    }

    private async Task<AvailabilitySlot?> FindPendingSlotAsync(
        Guid id)
    {
        var pending =
            await _availabilityService.GetPendingAsync();

        return pending
            .FirstOrDefault(x => x.Id == id);
    }
}
