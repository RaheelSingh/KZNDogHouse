using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IDogMedicalRecordRepository
{
    Task<IReadOnlyList<DogMedicalRecord>> GetByDogIdAsync(Guid dogId);

    Task<DogMedicalRecord> CreateAsync(DogMedicalRecord record);

    Task UpdateStatusAsync(Guid recordId, string status);
}

public class DogMedicalRecordRepository : IDogMedicalRecordRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public DogMedicalRecordRepository(ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<DogMedicalRecord>> GetByDogIdAsync(Guid dogId)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<DogMedicalRecord>()
            .Where(x => x.DogId == dogId)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<DogMedicalRecord>();
        }

        return response.Models
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
    }

    public async Task<DogMedicalRecord> CreateAsync(DogMedicalRecord record)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<DogMedicalRecord>()
            .Insert(record);

        return response.Models.First();
    }

    public async Task UpdateStatusAsync(Guid recordId, string status)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<DogMedicalRecord>()
            .Where(x => x.Id == recordId)
            .Set(x => x.Status, status)
            .Update();
    }
}