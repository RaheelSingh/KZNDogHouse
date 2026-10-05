using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IAvailabilityService
{
    Task<IReadOnlyList<AvailabilitySlot>> GetAllAsync();

    Task<IReadOnlyList<AvailabilitySlot>> GetPendingAsync();

    Task<IReadOnlyList<AvailabilitySlot>> GetForVolunteerAsync(
        Guid volunteerId);

    Task<AvailabilitySubmissionResult> SubmitAsync(
        Guid volunteerId,
        DateTime dayDate,
        string slot);

    Task ApproveAsync(
        AvailabilitySlot slot,
        Guid reviewedByProfileId);

    Task RejectAsync(
        AvailabilitySlot slot,
        Guid reviewedByProfileId);
}

public record AvailabilitySubmissionResult(
    bool Success,
    string Message,
    AvailabilitySlot? Slot = null);

public class AvailabilityService : IAvailabilityService
{
    private readonly IAvailabilitySlotRepository _repository;
    private readonly INotificationService _notificationService;

    public AvailabilityService(
        IAvailabilitySlotRepository repository,
        INotificationService notificationService)
    {
        _repository = repository;
        _notificationService = notificationService;
    }

    public Task<IReadOnlyList<AvailabilitySlot>> GetAllAsync() =>
        _repository.GetAllAsync();

    public Task<IReadOnlyList<AvailabilitySlot>> GetPendingAsync() =>
        _repository.GetPendingAsync();

    public Task<IReadOnlyList<AvailabilitySlot>> GetForVolunteerAsync(
        Guid volunteerId) =>
        _repository.GetForVolunteerAsync(volunteerId);

    public async Task<AvailabilitySubmissionResult> SubmitAsync(
        Guid volunteerId,
        DateTime dayDate,
        string slot)
    {
        var normalizedDate = dayDate.Date;

        if (normalizedDate < DateTime.UtcNow.Date)
        {
            return new AvailabilitySubmissionResult(
                false,
                "Availability cannot be submitted for a past date.");
        }

        var normalizedSlot = AvailabilitySlotNames.All
            .FirstOrDefault(x => string.Equals(
                x,
                slot?.Trim(),
                StringComparison.OrdinalIgnoreCase));

        if (normalizedSlot == null)
        {
            return new AvailabilitySubmissionResult(
                false,
                "Choose Morning, Afternoon or Evening.");
        }

        var existing = await _repository.GetForVolunteerAsync(volunteerId);

        var duplicate = existing.FirstOrDefault(x =>
            x.DayDate.Date == normalizedDate
            && x.Slot == normalizedSlot
            && (x.Status == AvailabilitySlotStatuses.Pending
                || x.Status == AvailabilitySlotStatuses.Approved));

        if (duplicate != null)
        {
            return new AvailabilitySubmissionResult(
                false,
                "You already have pending or approved availability for this date and time slot.",
                duplicate);
        }

        var dayOffset = ((int)normalizedDate.DayOfWeek + 6) % 7;
        var weekStart = normalizedDate.AddDays(-dayOffset);

        var availability = new AvailabilitySlot
        {
            Id = Guid.NewGuid(),
            VolunteerId = volunteerId,
            WeekStart = weekStart,
            DayDate = normalizedDate,
            Slot = normalizedSlot,
            Status = AvailabilitySlotStatuses.Pending,
            SubmittedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(availability);

        var body = $"New {normalizedSlot.ToLowerInvariant()} availability was submitted for {normalizedDate:dd MMM yyyy}.";

        await _notificationService.NotifyActiveRoleAsync(
            UserRoles.Staff,
            NotificationCategories.General,
            "New availability submission",
            body);

        await _notificationService.NotifyActiveRoleAsync(
            UserRoles.Administrator,
            NotificationCategories.General,
            "New availability submission",
            body);

        return new AvailabilitySubmissionResult(
            true,
            "Availability submitted for staff review.",
            created);
    }

    public async Task ApproveAsync(
        AvailabilitySlot slot,
        Guid reviewedByProfileId)
    {
        await _repository.ReviewAsync(
            slot.Id,
            AvailabilitySlotStatuses.Approved,
            reviewedByProfileId);

        await _notificationService.NotifyUserAsync(
            slot.VolunteerId,
            NotificationCategories.General,
            "Availability confirmed",
            $"Your {slot.Slot} slot on {slot.DayDate:dd MMM} was approved.");
    }

    public async Task RejectAsync(
        AvailabilitySlot slot,
        Guid reviewedByProfileId)
    {
        await _repository.ReviewAsync(
            slot.Id,
            AvailabilitySlotStatuses.Rejected,
            reviewedByProfileId);

        await _notificationService.NotifyUserAsync(
            slot.VolunteerId,
            NotificationCategories.General,
            "Availability not approved",
            $"Your {slot.Slot} slot on {slot.DayDate:dd MMM} was not approved this time.");
    }
}
