using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Route("get-involved")]
public class GetInvolvedController : Controller
{
    private const int EventCount = 3;

    private readonly ICalendarEventService _calendarEventService;
    private readonly ILogger<GetInvolvedController> _logger;

    public GetInvolvedController(
        ICalendarEventService calendarEventService,
        ILogger<GetInvolvedController> logger)
    {
        _calendarEventService = calendarEventService;
        _logger = logger;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        var model = new GetInvolvedViewModel();

        try
        {
            var upcoming = await _calendarEventService.GetPublicUpcomingAsync();

            model.UpcomingEvents = upcoming
                .Select(PublicEventItem.FromEvent)
                .OrderBy(x => x.StartAt)
                .Take(EventCount)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Upcoming events could not be loaded for the get involved page.");
        }

        return View(model);
    }
}
