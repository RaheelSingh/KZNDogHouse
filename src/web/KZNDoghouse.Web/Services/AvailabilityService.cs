using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IAvailabilityService
{
    Task<IReadOnlyList<AvailabilitySlot>> GetPendingAsync();

    Task ApproveAsync(Guid slotId, Guid reviewedByProfileId);

    Task RejectAsync(Guid slotId, Guid reviewedByProfileId);
}

public class AvailabilityService : IAvailabilityService
{
    private readonly IAvailabilitySlotRepository _repository;

    public AvailabilityService(IAvailabilitySlotRepository repository)
    {
        _repository = repository;
    }

    public Task<IReadOnlyList<AvailabilitySlot>> GetPendingAsync() =>
        _repository.GetPendingAsync();

    public Task ApproveAsync(Guid slotId, Guid reviewedByProfileId) =>
        _repository.ReviewAsync(slotId, AvailabilitySlotStatuses.Approved, reviewedByProfileId);

    public Task RejectAsync(Guid slotId, Guid reviewedByProfileId) =>
        _repository.ReviewAsync(slotId, AvailabilitySlotStatuses.Rejected, reviewedByProfileId);
}