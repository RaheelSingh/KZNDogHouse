using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IEventRegistrationService
{
    Task<IReadOnlyList<EventAssignment>> GetAllAsync();

    Task<IReadOnlyList<EventAssignment>> GetForProfileAsync(Guid profileId);

    Task<EventRegistrationResult> RegisterAsync(
        Guid eventId,
        Guid profileId);

    Task<EventRegistrationResult> CancelAsync(
        Guid eventId,
        Guid profileId);

    Task<EventRegistrationResult> ReviewAsync(Guid assignmentId, string status);
}

public record EventRegistrationResult(
    bool Success,
    string Message,
    EventAssignment? Assignment = null);

public class EventRegistrationService : IEventRegistrationService
{
    private readonly ICalendarEventRepository _calendarEventRepository;
    private readonly IEventAssignmentRepository _eventAssignmentRepository;
    private readonly INotificationService _notificationService;

    public EventRegistrationService(
        ICalendarEventRepository calendarEventRepository,
        IEventAssignmentRepository eventAssignmentRepository,
        INotificationService notificationService)
    {
        _calendarEventRepository = calendarEventRepository;
        _eventAssignmentRepository = eventAssignmentRepository;
        _notificationService = notificationService;
    }

    public Task<IReadOnlyList<EventAssignment>> GetAllAsync() =>
        _eventAssignmentRepository.GetAllAsync();

    public Task<IReadOnlyList<EventAssignment>> GetForProfileAsync(
        Guid profileId) =>
        _eventAssignmentRepository.GetByProfileAsync(profileId);

    public async Task<EventRegistrationResult> RegisterAsync(
        Guid eventId,
        Guid profileId)
    {
        var calendarEvent =
            await _calendarEventRepository.GetByIdAsync(eventId);

        if (calendarEvent == null)
        {
            return new EventRegistrationResult(
                false,
                "Event not found.");
        }

        if (calendarEvent.StartAt <= DateTime.UtcNow)
        {
            return new EventRegistrationResult(
                false,
                "Registration is only available for upcoming events.");
        }

        if (!calendarEvent.VolunteerSignupEnabled)
        {
            return new EventRegistrationResult(
                false,
                "Volunteer signup is not enabled for this event.");
        }

        if (!calendarEvent.MaxVolunteers.HasValue
            || !calendarEvent.VolunteerStartAt.HasValue
            || !calendarEvent.VolunteerEndAt.HasValue
            || calendarEvent.VolunteerEndAt.Value <= calendarEvent.VolunteerStartAt.Value)
        {
            return new EventRegistrationResult(
                false,
                "Volunteer signup has not been configured correctly for this event.");
        }

        var existing =
            await _eventAssignmentRepository
                .GetByEventAndProfileAsync(
                    eventId,
                    profileId);

        if (existing != null && existing.Status != EventAssignmentStatuses.Cancelled)
        {
            return new EventRegistrationResult(
                false,
                "You already have an application for this event.",
                existing);
        }

        if (existing != null)
        {
            await _eventAssignmentRepository.UpdateStatusAsync(
                existing.Id,
                EventAssignmentStatuses.Pending);

            existing.Status = EventAssignmentStatuses.Pending;

            return new EventRegistrationResult(
                true,
                "Your volunteer application is awaiting review.",
                existing);
        }

        var assignment = new EventAssignment
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            ProfileId = profileId,
            Status = EventAssignmentStatuses.Pending,
            CreatedAt = DateTime.UtcNow
        };

        var created =
            await _eventAssignmentRepository.CreateAsync(assignment);

        return new EventRegistrationResult(
            true,
            "Your volunteer application is awaiting review.",
            created);
    }

    public async Task<EventRegistrationResult> CancelAsync(
        Guid eventId,
        Guid profileId)
    {
        var existing =
            await _eventAssignmentRepository
                .GetByEventAndProfileAsync(
                    eventId,
                    profileId);

        if (existing == null)
        {
            return new EventRegistrationResult(
                false,
                "No registration was found for this event.");
        }

        if (existing.Status == EventAssignmentStatuses.Cancelled)
        {
            return new EventRegistrationResult(
                true,
                "This registration is already cancelled.",
                existing);
        }

        await _eventAssignmentRepository.UpdateStatusAsync(
            existing.Id,
            EventAssignmentStatuses.Cancelled);

        existing.Status = EventAssignmentStatuses.Cancelled;

        return new EventRegistrationResult(
            true,
            "Event registration cancelled.",
            existing);
    }

    public async Task<EventRegistrationResult> ReviewAsync(Guid assignmentId, string status)
    {
        if (!EventAssignmentStatuses.ReviewOptions.Contains(status))
        {
            return new EventRegistrationResult(false, "Choose a valid volunteer status.");
        }

        var assignment = await _eventAssignmentRepository.GetByIdAsync(assignmentId);
        if (assignment == null)
        {
            return new EventRegistrationResult(false, "Volunteer application not found.");
        }

        var calendarEvent = await _calendarEventRepository.GetByIdAsync(assignment.EventId);
        if (calendarEvent == null)
        {
            return new EventRegistrationResult(false, "Event not found.");
        }

        if (calendarEvent.StartAt <= DateTime.UtcNow || assignment.Status == EventAssignmentStatuses.Cancelled)
        {
            return new EventRegistrationResult(false, "This application can no longer be reviewed.", assignment);
        }

        // The database function locks the event row, checks the confirmed count,
        // and returns false for a repeated decision. A local count is not sufficient.
        var changed = await _eventAssignmentRepository.ReviewStatusAsync(assignmentId, status);
        assignment.Status = status;
        if (!changed)
        {
            return new EventRegistrationResult(true, "This volunteer already has that status.", assignment);
        }

        var arrival = calendarEvent.VolunteerStartAt ?? calendarEvent.StartAt;
        var description = status switch
        {
            EventAssignmentStatuses.Confirmed =>
                $"You're confirmed for {calendarEvent.Title}. Please arrive on {arrival:dd MMM yyyy} at {arrival:HH:mm}. " +
                (calendarEvent.VolunteerNotes ?? string.Empty),
            EventAssignmentStatuses.Reserve =>
                $"You're on standby for {calendarEvent.Title}. If a place becomes available, we'll contact you.",
            _ =>
                $"Thank you for offering to help with {calendarEvent.Title}. All volunteer places have been filled for now. We'll be in touch if more help is needed."
        };
        var title = status switch
        {
            EventAssignmentStatuses.Confirmed => "Volunteer place confirmed",
            EventAssignmentStatuses.Reserve => "You're on standby",
            _ => "Volunteer application update"
        };

        await _notificationService.NotifyUserAsync(
            assignment.ProfileId,
            NotificationCategories.Calendar,
            title,
            description.Trim());

        return new EventRegistrationResult(true, "Volunteer status updated.", assignment);
    }

}
