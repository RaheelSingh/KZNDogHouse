using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IEventRegistrationService
{
    Task<IReadOnlyList<EventAssignment>> GetForProfileAsync(Guid profileId);

    Task<EventRegistrationResult> RegisterAsync(
        Guid eventId,
        Guid profileId);

    Task<EventRegistrationResult> CancelAsync(
        Guid eventId,
        Guid profileId);
}

public record EventRegistrationResult(
    bool Success,
    string Message,
    EventAssignment? Assignment = null);

public class EventRegistrationService : IEventRegistrationService
{
    private readonly ICalendarEventRepository _calendarEventRepository;
    private readonly IAvailabilitySlotRepository _availabilitySlotRepository;
    private readonly IEventAssignmentRepository _eventAssignmentRepository;
    private readonly INotificationService _notificationService;

    public EventRegistrationService(
        ICalendarEventRepository calendarEventRepository,
        IAvailabilitySlotRepository availabilitySlotRepository,
        IEventAssignmentRepository eventAssignmentRepository,
        INotificationService notificationService)
    {
        _calendarEventRepository = calendarEventRepository;
        _availabilitySlotRepository = availabilitySlotRepository;
        _eventAssignmentRepository = eventAssignmentRepository;
        _notificationService = notificationService;
    }

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

        if (calendarEvent.Category != EventCategories.Shift
            && calendarEvent.Category != EventCategories.PublicEvent)
        {
            return new EventRegistrationResult(
                false,
                "This event is not open for volunteer self-registration.");
        }

        var requiredSlot = SlotFor(calendarEvent.StartAt);

        var availability =
            await _availabilitySlotRepository
                .GetForVolunteerAsync(profileId);

        var hasApprovedAvailability = availability.Any(x =>
            x.Status == AvailabilitySlotStatuses.Approved
            && x.DayDate.Date == calendarEvent.StartAt.Date
            && x.Slot == requiredSlot);

        if (!hasApprovedAvailability)
        {
            return new EventRegistrationResult(
                false,
                $"You need approved {requiredSlot.ToLowerInvariant()} availability for {calendarEvent.StartAt:dd MMM yyyy} before registering for this event.");
        }

        var existing =
            await _eventAssignmentRepository
                .GetByEventAndProfileAsync(
                    eventId,
                    profileId);

        if (existing != null)
        {
            if (existing.Status != EventAssignmentStatuses.Cancelled)
            {
                return new EventRegistrationResult(
                    false,
                    "You are already registered or assigned to this event.",
                    existing);
            }

            await _eventAssignmentRepository.UpdateStatusAsync(
                existing.Id,
                EventAssignmentStatuses.Registered);

            existing.Status = EventAssignmentStatuses.Registered;

            await SendConfirmationAsync(
                profileId,
                calendarEvent);

            return new EventRegistrationResult(
                true,
                "Event registration restored.",
                existing);
        }

        var assignment = new EventAssignment
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            ProfileId = profileId,
            Status = EventAssignmentStatuses.Registered,
            CreatedAt = DateTime.UtcNow
        };

        var created =
            await _eventAssignmentRepository.CreateAsync(assignment);

        await SendConfirmationAsync(
            profileId,
            calendarEvent);

        return new EventRegistrationResult(
            true,
            "Event registration confirmed.",
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

    private async Task SendConfirmationAsync(
        Guid profileId,
        CalendarEvent calendarEvent)
    {
        await _notificationService.NotifyUserAsync(
            profileId,
            NotificationCategories.Calendar,
            "Event registration confirmed",
            $"You are registered for {calendarEvent.Title} on {calendarEvent.StartAt:dd MMM} at {calendarEvent.StartAt:HH:mm}.");
    }

    private static string SlotFor(DateTime startAt)
    {
        if (startAt.Hour < 12)
        {
            return AvailabilitySlotNames.Morning;
        }

        if (startAt.Hour < 17)
        {
            return AvailabilitySlotNames.Afternoon;
        }

        return AvailabilitySlotNames.Evening;
    }
}
