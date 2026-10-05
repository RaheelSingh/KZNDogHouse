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
    private readonly IEventAssignmentRepository _eventAssignmentRepository;
    private readonly IMediaStorageService _mediaStorageService;
    private readonly ILogger<CalendarController> _logger;

    public CalendarController(
        ICalendarEventService calendarEventService,
        IUserProfileRepository userProfileRepository,
        IEventAssignmentRepository eventAssignmentRepository,
        IMediaStorageService mediaStorageService,
        ILogger<CalendarController> logger)
    {
        _calendarEventService = calendarEventService;
        _userProfileRepository = userProfileRepository;
        _eventAssignmentRepository = eventAssignmentRepository;
        _mediaStorageService = mediaStorageService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        try
        {
            var events = await _calendarEventService.GetAllAsync();
            var assignments = await _eventAssignmentRepository.GetAllAsync();
            var profiles = await _userProfileRepository.GetAllAsync();

            ViewData["EventAssignments"] = assignments;
            ViewData["ProfilesById"] = profiles.ToDictionary(x => x.Id);

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
        bool volunteerSignupEnabled,
        int? maxVolunteers,
        DateTime? volunteerStartAt,
        DateTime? volunteerEndAt,
        string? volunteerNotes,
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

        if (!EventCategories.All.Contains(category)
            || !EventVisibilities.All.Contains(visibility))
        {
            TempData["ErrorMessage"] =
                "Choose a valid event category and visibility.";
            return RedirectToAction(nameof(Index));
        }

        if (title.Trim().Length > 150
            || (description?.Trim().Length ?? 0) > 1500
            || (location?.Trim().Length ?? 0) > 200
            || (volunteerNotes?.Trim().Length ?? 0) > 1000)
        {
            TempData["ErrorMessage"] =
                "One or more event fields are longer than the allowed limit.";
            return RedirectToAction(nameof(Index));
        }

        if (volunteerSignupEnabled)
        {
            if (!maxVolunteers.HasValue
                || maxVolunteers.Value < 1
                || maxVolunteers.Value > 200)
            {
                TempData["ErrorMessage"] =
                    "Enter a volunteer capacity between 1 and 200.";
                return RedirectToAction(nameof(Index));
            }

            if (!volunteerStartAt.HasValue || !volunteerEndAt.HasValue)
            {
                TempData["ErrorMessage"] =
                    "Volunteer start and end times are required when signup is enabled.";
                return RedirectToAction(nameof(Index));
            }

            if (volunteerEndAt.Value <= volunteerStartAt.Value)
            {
                TempData["ErrorMessage"] =
                    "Volunteer end time must be after the volunteer start time.";
                return RedirectToAction(nameof(Index));
            }
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
                    volunteerSignupEnabled,
                    maxVolunteers,
                    volunteerStartAt,
                    volunteerEndAt,
                    volunteerNotes,
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
