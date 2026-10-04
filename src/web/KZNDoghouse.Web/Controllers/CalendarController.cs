using System.Security.Claims;
using KZNDoghouse.Web.Constants;
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
    private readonly IMediaStorageService _mediaStorageService;
    private readonly ILogger<CalendarController> _logger;

    public CalendarController(
        ICalendarEventService calendarEventService,
        IUserProfileRepository userProfileRepository,
        IMediaStorageService mediaStorageService,
        ILogger<CalendarController> logger)
    {
        _calendarEventService = calendarEventService;
        _userProfileRepository = userProfileRepository;
        _mediaStorageService = mediaStorageService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        try
        {
            var events = await _calendarEventService.GetAllAsync();
            return View(events);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Calendar events could not be loaded.");

            TempData["ErrorMessage"] =
                "Calendar events could not be loaded right now.";

            return View(
                Array.Empty<KZNDoghouse.Web.Models.CalendarEvent>());
        }
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
        Guid? dogId,
        IFormFile? imageFile)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            TempData["ErrorMessage"] =
                "Event title is required.";

            return RedirectToAction(nameof(Index));
        }

        if (startAt == default)
        {
            TempData["ErrorMessage"] =
                "Choose a start date and time.";

            return RedirectToAction(nameof(Index));
        }

        if (endAt.HasValue && endAt.Value < startAt)
        {
            TempData["ErrorMessage"] =
                "The event end time cannot be before the start time.";

            return RedirectToAction(nameof(Index));
        }

        var profile = await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        try
        {
            var calendarEvent =
                await _calendarEventService.CreateAsync(
                    title.Trim(),
                    category,
                    string.IsNullOrWhiteSpace(description)
                        ? null
                        : description.Trim(),
                    string.IsNullOrWhiteSpace(location)
                        ? null
                        : location.Trim(),
                    startAt,
                    endAt,
                    visibility,
                    dogId,
                    profile.Id);

            if (imageFile != null && imageFile.Length > 0)
            {
                var upload =
                    await _mediaStorageService.UploadPublicImageAsync(
                        imageFile,
                        StorageFolders.Events,
                        calendarEvent.Id);

                if (upload.Success)
                {
                    await _calendarEventService.UpdateImageAsync(
                        calendarEvent.Id,
                        upload.StoragePath,
                        upload.PublicUrl);
                }
                else
                {
                    TempData["ErrorMessage"] =
                        $"The event was created, but its image was not uploaded. {upload.Message}";
                }
            }

            TempData["SuccessMessage"] =
                $"Event \"{calendarEvent.Title}\" added.";
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Calendar event {EventTitle} could not be created.",
                title);

            TempData["ErrorMessage"] =
                "The event could not be saved. Check the database setup and try again.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateImage(
        Guid id,
        IFormFile imageFile)
    {
        try
        {
            var calendarEvent =
                await _calendarEventService.GetByIdAsync(id);

            if (calendarEvent == null)
            {
                return NotFound();
            }

            var upload =
                await _mediaStorageService.UploadPublicImageAsync(
                    imageFile,
                    StorageFolders.Events,
                    id);

            if (!upload.Success)
            {
                TempData["ErrorMessage"] = upload.Message;
                return RedirectToAction(nameof(Index));
            }

            var previousPath = calendarEvent.ImagePath;

            await _calendarEventService.UpdateImageAsync(
                id,
                upload.StoragePath,
                upload.PublicUrl);

            await _mediaStorageService
                .DeletePublicImageAsync(previousPath);

            TempData["SuccessMessage"] =
                "Event image updated.";
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Image for calendar event {EventId} could not be updated.",
                id);

            TempData["ErrorMessage"] =
                "The event image could not be updated.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            var calendarEvent =
                await _calendarEventService.GetByIdAsync(id);

            if (calendarEvent == null)
            {
                return NotFound();
            }

            await _calendarEventService.DeleteAsync(id);

            await _mediaStorageService
                .DeletePublicImageAsync(calendarEvent.ImagePath);

            TempData["SuccessMessage"] =
                "Event removed.";
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Calendar event {EventId} could not be removed.",
                id);

            TempData["ErrorMessage"] =
                "The event could not be removed.";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task<KZNDoghouse.Web.Models.UserProfile?>
        GetCurrentProfileAsync()
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
}
