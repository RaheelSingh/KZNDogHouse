using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IFosteringService
{
    Task<IReadOnlyList<FosteringRecord>> GetHistoryForDogAsync(Guid dogId);

    Task<FosteringRecord> StartFosteringAsync(
        Guid dogId,
        Guid? fosterProfileId,
        string? fosterName,
        Guid createdByProfileId);

    Task ReturnDogAsync(Guid fosteringRecordId, Guid dogId, string? feedback);
}

public class FosteringService : IFosteringService
{
    private readonly IFosteringRecordRepository _fosteringRecordRepository;
    private readonly IDogService _dogService;

    public FosteringService(
        IFosteringRecordRepository fosteringRecordRepository,
        IDogService dogService)
    {
        _fosteringRecordRepository = fosteringRecordRepository;
        _dogService = dogService;
    }

    public Task<IReadOnlyList<FosteringRecord>> GetHistoryForDogAsync(Guid dogId) =>
        _fosteringRecordRepository.GetByDogIdAsync(dogId);

    public async Task<FosteringRecord> StartFosteringAsync(
        Guid dogId,
        Guid? fosterProfileId,
        string? fosterName,
        Guid createdByProfileId)
    {
        var record = new FosteringRecord
        {
            Id = Guid.NewGuid(),
            DogId = dogId,
            FosterProfileId = fosterProfileId,
            FosterName = fosterName,
            StartDate = DateTime.UtcNow,
            Status = FosteringRecordStatuses.Active,
            CreatedBy = createdByProfileId,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _fosteringRecordRepository.CreateAsync(record);

       
        await _dogService.ChangeStatusAsync(dogId, DogStatuses.Fostered);

        return created;
    }

    public async Task ReturnDogAsync(Guid fosteringRecordId, Guid dogId, string? feedback)
    {
        await _fosteringRecordRepository.CompleteAsync(fosteringRecordId, feedback);

        await _dogService.ChangeStatusAsync(dogId, DogStatuses.Available);
    }
}