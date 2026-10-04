using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IAvailabilityService
{
    Task<IReadOnlyList<AvailabilitySlot>> GetAllAsync();

    Task<IReadOnlyList<AvailabilitySlot>> GetPendingAsync();

    Task ApproveAsync(
        AvailabilitySlot slot,
        Guid reviewedByProfileId);

    Task RejectAsync(
        AvailabilitySlot slot,
        Guid reviewedByProfileId);
}

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
