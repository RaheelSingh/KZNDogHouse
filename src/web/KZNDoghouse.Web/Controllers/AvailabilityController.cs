using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public class AvailabilityController : Controller
{
    private readonly ICalendarEventService _calendarEventService;
    private readonly IEventAssignmentRepository _eventAssignmentRepository;
    private readonly IEventRegistrationService _eventRegistrationService;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly ILogger<AvailabilityController> _logger;

    public AvailabilityController(
        ICalendarEventService calendarEventService,
        IEventAssignmentRepository eventAssignmentRepository,
        IEventRegistrationService eventRegistrationService,
        IUserProfileRepository userProfileRepository,
        ILogger<AvailabilityController> logger)
    {
        _calendarEventService = calendarEventService;
        _eventAssignmentRepository = eventAssignmentRepository;
        _eventRegistrationService = eventRegistrationService;
        _userProfileRepository = userProfileRepository;
        _logger = logger;
    }

    [HttpGet("/Volunteers", Name = "volunteer-applications")]
    [HttpGet("/Availability")]
    public async Task<IActionResult> Index()
    {
        try
        {
            var eventsTask = _calendarEventService.GetAllAsync();
            var assignmentsTask = _eventAssignmentRepository.GetAllAsync();
            var profilesTask = _userProfileRepository.GetAllAsync();
            await Task.WhenAll(eventsTask, assignmentsTask, profilesTask);

            var eventsById = (await eventsTask).ToDictionary(x => x.Id);
            var assignments = await assignmentsTask;
            var namesById = (await profilesTask).ToDictionary(x => x.Id, x => x.FullName);
            var confirmedByEvent = assignments
                .Where(x => EventAssignmentStatuses.CountsTowardCapacity(x.Status))
                .GroupBy(x => x.EventId)
                .ToDictionary(g => g.Key, g => g.Count());

            var items = assignments
                .Where(x => eventsById.ContainsKey(x.EventId))
                .Select(x => new VolunteerApplicationListItem
                {
                    Assignment = x,
                    Event = eventsById[x.EventId],
                    VolunteerName = namesById.TryGetValue(x.ProfileId, out var name)
                        && !string.IsNullOrWhiteSpace(name) ? name : "Volunteer",
                    ConfirmedCount = confirmedByEvent.GetValueOrDefault(x.EventId)
                })
                .OrderBy(x => x.Assignment.Status == EventAssignmentStatuses.Pending ? 0 : 1)
                .ThenByDescending(x => x.Event.StartAt)
                .ThenByDescending(x => x.Assignment.CreatedAt)
                .ToList();

            return View(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Volunteer applications could not be loaded.");
            TempData["ErrorMessage"] = "Volunteer applications could not be loaded right now.";
            return View(Array.Empty<VolunteerApplicationListItem>());
        }
    }

    [HttpPost("/Volunteers/Review")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Review(Guid assignmentId, string status)
    {
        if (!EventAssignmentStatuses.ReviewOptions.Contains(status))
        {
            TempData["ErrorMessage"] = "Choose a valid volunteer status.";
            return RedirectToRoute("volunteer-applications");
        }

        try
        {
            var result = await _eventRegistrationService.ReviewAsync(assignmentId, status);
            TempData[result.Success ? "SuccessMessage" : "ErrorMessage"] = result.Message;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unable to review volunteer application {AssignmentId}", assignmentId);
            TempData["ErrorMessage"] = ex.Message.Contains("volunteer places", StringComparison.OrdinalIgnoreCase)
                ? "All volunteer places are filled. Put this applicant on standby instead."
                : "Unable to update this application. Please try again.";
        }

        return RedirectToRoute("volunteer-applications");
    }
}
