using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IDogMedicalService
{
    Task<IReadOnlyList<DogMedicalRecord>> GetRecordsAsync(Guid dogId);

    Task<IReadOnlyList<DogNote>> GetNotesAsync(Guid dogId);

    Task AddRecordAsync(
        Guid dogId,
        string recordType,
        string title,
        string? details,
        string? vetName,
        DateTime? nextActionDate,
        Guid createdByProfileId);

    Task ResolveRecordAsync(Guid recordId);

    Task AddNoteAsync(Guid dogId, string note, Guid? authorProfileId);
}

public class DogMedicalService : IDogMedicalService
{
    private readonly IDogMedicalRecordRepository _recordRepository;
    private readonly IDogNoteRepository _noteRepository;

    public DogMedicalService(
        IDogMedicalRecordRepository recordRepository,
        IDogNoteRepository noteRepository)
    {
        _recordRepository = recordRepository;
        _noteRepository = noteRepository;
    }

    public Task<IReadOnlyList<DogMedicalRecord>> GetRecordsAsync(Guid dogId) =>
        _recordRepository.GetByDogIdAsync(dogId);

    public Task<IReadOnlyList<DogNote>> GetNotesAsync(Guid dogId) =>
        _noteRepository.GetByDogIdAsync(dogId);

    public Task AddRecordAsync(
        Guid dogId,
        string recordType,
        string title,
        string? details,
        string? vetName,
        DateTime? nextActionDate,
        Guid createdByProfileId)
    {
        var record = new DogMedicalRecord
        {
            Id = Guid.NewGuid(),
            DogId = dogId,
            RecordType = recordType,
            Title = title,
            Details = details,
            VetName = vetName,
            NextActionDate = nextActionDate,
            Status = MedicalRecordStatuses.Active,
            CreatedBy = createdByProfileId,
            CreatedAt = DateTime.UtcNow
        };

        return _recordRepository.CreateAsync(record);
    }

    public Task ResolveRecordAsync(Guid recordId) =>
        _recordRepository.UpdateStatusAsync(recordId, MedicalRecordStatuses.Resolved);

    public Task AddNoteAsync(Guid dogId, string note, Guid? authorProfileId)
    {
        var dogNote = new DogNote
        {
            Id = Guid.NewGuid(),
            DogId = dogId,
            AuthorId = authorProfileId,
            Note = note,
            CreatedAt = DateTime.UtcNow
        };

        return _noteRepository.CreateAsync(dogNote);
    }
}