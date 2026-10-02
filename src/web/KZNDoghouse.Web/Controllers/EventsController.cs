using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Route("events")]
public class EventsController : Controller
{
    private const int UpcomingLimit = 6;
    private const int PastLimit = 6;

    private readonly ICalendarEventService _calendarEventService;
    private readonly ILogger<EventsController> _logger;

    public EventsController(
        ICalendarEventService calendarEventService,
        ILogger<EventsController> logger)
    {
        _calendarEventService = calendarEventService;
        _logger = logger;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(string? category)
    {
        try
        {
            var upcomingTask = _calendarEventService.GetPublicUpcomingAsync();
            var pastTask = _calendarEventService.GetPublicPastAsync();

            await Task.WhenAll(upcomingTask, pastTask);

            var upcoming = upcomingTask.Result
                .Select(PublicEventItem.FromEvent)
                .OrderBy(x => x.StartAt)
                .ToList();

            var past = pastTask.Result
                .Select(PublicEventItem.FromEvent)
                .OrderByDescending(x => x.StartAt)
                .ToList();

            var categories = upcoming
                .Concat(past)
                .Select(x => x.Category)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .ToList();

            var filter = PublicEventFilter.Create(category, categories);
            var matchingUpcoming = filter.Apply(upcoming);

            return View(new EventsPageViewModel
            {
                Featured = matchingUpcoming.FirstOrDefault(),
                Upcoming = matchingUpcoming.Skip(1).Take(UpcomingLimit).ToList(),
                Past = filter.Apply(past).Take(PastLimit).ToList(),
                Categories = categories,
                Filter = filter,
                OverallCount = upcoming.Count + past.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Public events could not be loaded.");

            ViewData["LoadFailed"] = true;

            return View(new EventsPageViewModel());
        }
    }
}
