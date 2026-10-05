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

        var availability =
            await _availabilitySlotRepository
                .GetForVolunteerAsync(profileId);

        var requiredSlots = RequiredAvailabilitySlots(
            calendarEvent.VolunteerStartAt.Value,
            calendarEvent.VolunteerEndAt.Value);

        var approvedKeys = availability
            .Where(x => x.Status == AvailabilitySlotStatuses.Approved)
            .Select(x => (x.DayDate.Date, x.Slot))
            .ToHashSet();

        var missingSlot = requiredSlots
            .FirstOrDefault(x => !approvedKeys.Contains((x.DayDate, x.Slot)));

        if (missingSlot != default)
        {
            return new EventRegistrationResult(
                false,
                $"You need approved {missingSlot.Slot.ToLowerInvariant()} availability for {missingSlot.DayDate:dd MMM yyyy} before registering for this event.");
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
                "You are already registered or assigned to this event.",
                existing);
        }

        var allAssignments =
            await _eventAssignmentRepository.GetAllAsync()
            ?? Array.Empty<EventAssignment>();

        var activeCount = allAssignments.Count(x =>
            x.EventId == eventId
            && x.Status != EventAssignmentStatuses.Cancelled);

        if (activeCount >= calendarEvent.MaxVolunteers.Value)
        {
            return new EventRegistrationResult(
                false,
                "This event has reached its volunteer capacity.");
        }

        if (existing != null)
        {
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
        var volunteerStart =
            calendarEvent.VolunteerStartAt
            ?? calendarEvent.StartAt;

        var volunteerEnd =
            calendarEvent.VolunteerEndAt
            ?? calendarEvent.EndAt;

        var timeText = volunteerEnd.HasValue
            ? $"{volunteerStart:dd MMM} from {volunteerStart:HH:mm} to {volunteerEnd:HH:mm}"
            : $"{volunteerStart:dd MMM} at {volunteerStart:HH:mm}";

        await _notificationService.NotifyUserAsync(
            profileId,
            NotificationCategories.Calendar,
            "Event registration confirmed",
            $"You are registered to volunteer for {calendarEvent.Title} on {timeText}.");
    }

    private static IReadOnlyList<(DateTime DayDate, string Slot)> RequiredAvailabilitySlots(
        DateTime startAt,
        DateTime endAt)
    {
        var required = new List<(DateTime DayDate, string Slot)>();
        var day = startAt.Date;
        var finalDay = endAt.AddTicks(-1).Date;

        while (day <= finalDay)
        {
            AddIfOverlapping(
                required,
                day,
                AvailabilitySlotNames.Morning,
                day,
                day.AddHours(12),
                startAt,
                endAt);

            AddIfOverlapping(
                required,
                day,
                AvailabilitySlotNames.Afternoon,
                day.AddHours(12),
                day.AddHours(17),
                startAt,
                endAt);

            AddIfOverlapping(
                required,
                day,
                AvailabilitySlotNames.Evening,
                day.AddHours(17),
                day.AddDays(1),
                startAt,
                endAt);

            day = day.AddDays(1);
        }

        return required;
    }

    private static void AddIfOverlapping(
        ICollection<(DateTime DayDate, string Slot)> required,
        DateTime dayDate,
        string slot,
        DateTime slotStart,
        DateTime slotEnd,
        DateTime eventStart,
        DateTime eventEnd)
    {
        if (eventStart < slotEnd && eventEnd > slotStart)
        {
            required.Add((dayDate.Date, slot));
        }
    }
}
