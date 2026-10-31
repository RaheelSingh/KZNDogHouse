using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.DTOs;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace KZNDoghouse.Web.Controllers;

[ApiController]
[Route("api/mobile")]
[EnableRateLimiting(RateLimitPolicies.Api)]
public class MobileApiController : ControllerBase
{
    private readonly IApiAuthenticationService _apiAuthenticationService;
    private readonly IDogService _dogService;
    private readonly ICalendarEventService _calendarEventService;
    private readonly IAvailabilityService _availabilityService;
    private readonly INotificationService _notificationService;
    private readonly IEventRegistrationService _eventRegistrationService;

    public MobileApiController(
        IApiAuthenticationService apiAuthenticationService,
        IDogService dogService,
        ICalendarEventService calendarEventService,
        IAvailabilityService availabilityService,
        INotificationService notificationService,
        IEventRegistrationService eventRegistrationService)
    {
        _apiAuthenticationService = apiAuthenticationService;
        _dogService = dogService;
        _calendarEventService = calendarEventService;
        _availabilityService = availabilityService;
        _notificationService = notificationService;
        _eventRegistrationService = eventRegistrationService;
    }

    [HttpGet("dogs")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<MobileDogDto>>>> Dogs()
    {
        var profile = await GetMobileProfileAsync();
        if (profile == null)
        {
            return MobileUnauthorized<IReadOnlyList<MobileDogDto>>();
        }

        var dogs = await _dogService.GetPublicDogsAsync();
        var result = dogs
            .Select(MobileDogDto.FromPublicDog)
            .ToList();

        return Ok(ApiResponse<IReadOnlyList<MobileDogDto>>.Ok(result));
    }

    [HttpGet("events")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<MobileEventDto>>>> Events()
    {
        var profile = await GetMobileProfileAsync();
        if (profile == null)
        {
            return MobileUnauthorized<IReadOnlyList<MobileEventDto>>();
        }

        var events = await _calendarEventService.GetAllAsync();
        var assignments = await _eventRegistrationService.GetAllAsync();
        var activeCounts = assignments
            .Where(x => EventAssignmentStatuses.CountsTowardCapacity(x.Status))
            .GroupBy(x => x.EventId)
            .ToDictionary(x => x.Key, x => x.Count());

        var result = events
            .Where(x => x.StartAt >= DateTime.UtcNow)
            .OrderBy(x => x.StartAt)
            .Select(x => MobileEventDto.FromEvent(
                x,
                activeCounts.GetValueOrDefault(x.Id)))
            .ToList();

        return Ok(ApiResponse<IReadOnlyList<MobileEventDto>>.Ok(result));
    }

    [HttpGet("availability")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<MobileAvailabilityDto>>>> Availability()
    {
        var volunteer = await GetVolunteerProfileAsync();
        if (volunteer == null)
        {
            return MobileUnauthorized<IReadOnlyList<MobileAvailabilityDto>>(
                "Volunteer access is required for availability.");
        }

        var slots = await _availabilityService.GetForVolunteerAsync(volunteer.Id);
        var result = slots
            .Select(MobileAvailabilityDto.FromSlot)
            .ToList();

        return Ok(ApiResponse<IReadOnlyList<MobileAvailabilityDto>>.Ok(result));
    }

    [HttpPost("availability")]
    public async Task<ActionResult<ApiResponse<MobileAvailabilityDto>>> SubmitAvailability(
        [FromBody] SubmitAvailabilityDto request)
    {
        var volunteer = await GetVolunteerProfileAsync();
        if (volunteer == null)
        {
            return MobileUnauthorized<MobileAvailabilityDto>(
                "Volunteer access is required for availability.");
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(
                ApiResponse<MobileAvailabilityDto>.Fail(
                    "A valid date and availability slot are required."));
        }

        var result = await _availabilityService.SubmitAsync(
            volunteer.Id,
            request.DayDate,
            request.Slot);

        if (!result.Success || result.Slot == null)
        {
            return BadRequest(
                ApiResponse<MobileAvailabilityDto>.Fail(result.Message));
        }

        return Ok(
            ApiResponse<MobileAvailabilityDto>.Ok(
                MobileAvailabilityDto.FromSlot(result.Slot),
                result.Message));
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<MobileNotificationDto>>>> Notifications()
    {
        var profile = await GetMobileProfileAsync();
        if (profile == null)
        {
            return MobileUnauthorized<IReadOnlyList<MobileNotificationDto>>();
        }

        var notifications =
            await _notificationService.GetRecentForRecipientAsync(
                profile.Id,
                100);

        var result = notifications
            .Select(MobileNotificationDto.FromNotification)
            .ToList();

        return Ok(ApiResponse<IReadOnlyList<MobileNotificationDto>>.Ok(result));
    }

    [HttpPost("notifications/{notificationId:guid}/read")]
    public async Task<ActionResult<ApiResponse<object>>> MarkNotificationRead(
        Guid notificationId)
    {
        var profile = await GetMobileProfileAsync();
        if (profile == null)
        {
            return MobileUnauthorized<object>();
        }

        await _notificationService.MarkAsReadAsync(
            notificationId,
            profile.Id);

        return Ok(
            ApiResponse<object>.Ok(
                new { notificationId },
                "Notification marked as read."));
    }

    [HttpPost("notifications/read-all")]
    public async Task<ActionResult<ApiResponse<object>>> MarkAllNotificationsRead()
    {
        var profile = await GetMobileProfileAsync();
        if (profile == null)
        {
            return MobileUnauthorized<object>();
        }

        await _notificationService.MarkAllAsReadAsync(profile.Id);

        return Ok(
            ApiResponse<object>.Ok(
                new { profileId = profile.Id },
                "All notifications marked as read."));
    }

    [HttpGet("event-registrations")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<MobileEventRegistrationDto>>>> EventRegistrations()
    {
        var volunteer = await GetVolunteerProfileAsync();
        if (volunteer == null)
        {
            return MobileUnauthorized<IReadOnlyList<MobileEventRegistrationDto>>(
                "Volunteer access is required for event registration.");
        }

        var assignments =
            await _eventRegistrationService.GetForProfileAsync(volunteer.Id);

        var result = assignments
            .Select(MobileEventRegistrationDto.FromAssignment)
            .ToList();

        return Ok(
            ApiResponse<IReadOnlyList<MobileEventRegistrationDto>>.Ok(result));
    }

    [HttpPost("events/{eventId:guid}/register")]
    public async Task<ActionResult<ApiResponse<MobileEventRegistrationDto>>> RegisterForEvent(
        Guid eventId)
    {
        var volunteer = await GetVolunteerProfileAsync();
        if (volunteer == null)
        {
            return MobileUnauthorized<MobileEventRegistrationDto>(
                "Volunteer access is required for event registration.");
        }

        var result = await _eventRegistrationService.RegisterAsync(
            eventId,
            volunteer.Id);

        if (!result.Success || result.Assignment == null)
        {
            return BadRequest(
                ApiResponse<MobileEventRegistrationDto>.Fail(result.Message));
        }

        return Ok(
            ApiResponse<MobileEventRegistrationDto>.Ok(
                MobileEventRegistrationDto.FromAssignment(result.Assignment),
                result.Message));
    }

    [HttpPost("events/{eventId:guid}/cancel")]
    public async Task<ActionResult<ApiResponse<MobileEventRegistrationDto>>> CancelEventRegistration(
        Guid eventId)
    {
        var volunteer = await GetVolunteerProfileAsync();
        if (volunteer == null)
        {
            return MobileUnauthorized<MobileEventRegistrationDto>(
                "Volunteer access is required for event registration.");
        }

        var result = await _eventRegistrationService.CancelAsync(
            eventId,
            volunteer.Id);

        if (!result.Success || result.Assignment == null)
        {
            return BadRequest(
                ApiResponse<MobileEventRegistrationDto>.Fail(result.Message));
        }

        return Ok(
            ApiResponse<MobileEventRegistrationDto>.Ok(
                MobileEventRegistrationDto.FromAssignment(result.Assignment),
                result.Message));
    }

    private async Task<UserProfile?> GetMobileProfileAsync()
    {
        var profile = await _apiAuthenticationService.AuthenticateAsync(
            Request.Headers.Authorization.ToString());

        if (profile == null)
        {
            return null;
        }

        return profile.Role is UserRoles.Volunteer
            or UserRoles.Staff
            or UserRoles.Administrator
                ? profile
                : null;
    }

    private async Task<UserProfile?> GetVolunteerProfileAsync()
    {
        var profile = await GetMobileProfileAsync();

        return profile?.Role == UserRoles.Volunteer
            ? profile
            : null;
    }

    private UnauthorizedObjectResult MobileUnauthorized<T>(
        string message = "A valid Volunteer, Staff or Administrator mobile account is required.")
    {
        return Unauthorized(ApiResponse<T>.Fail(message));
    }
}
