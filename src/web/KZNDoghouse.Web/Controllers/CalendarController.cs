using System.Security.Claims;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public class CalendarController : Controller
{
    private readonly ICalendarEventService _calendarEventService;
    private readonly IUserProfileRepository _userProfileRepository;

    public CalendarController(
        ICalendarEventService calendarEventService,
        IUserProfileRepository userProfileRepository)
    {
        _calendarEventService = calendarEventService;
        _userProfileRepository = userProfileRepository;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var events = await _calendarEventService.GetAllAsync();

        return View(events);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        string title,
        string category,
        string? description,
        string? location,
        DateTime startAt,
        DateTime? endAt,
        string visibility,
        Guid? dogId)
    {
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authId))
        {
            return Challenge();
        }

        var profile = await _userProfileRepository.GetByAuthUserIdAsync(authId);

        if (profile == null)
        {
            return Challenge();
        }

        await _calendarEventService.CreateAsync(
            title, category, description, location, startAt, endAt, visibility, dogId, profile.Id);

        TempData["SuccessMessage"] = "Event added.";

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _calendarEventService.DeleteAsync(id);

        TempData["SuccessMessage"] = "Event removed.";

        return RedirectToAction(nameof(Index));
    }
}