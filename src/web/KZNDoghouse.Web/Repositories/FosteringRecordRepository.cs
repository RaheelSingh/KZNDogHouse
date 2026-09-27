using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IFosteringRecordRepository
{
    Task<IReadOnlyList<FosteringRecord>> GetByDogIdAsync(Guid dogId);

    Task<FosteringRecord> CreateAsync(FosteringRecord record);

    Task CompleteAsync(Guid id, string? feedback);
}

public class FosteringRecordRepository : IFosteringRecordRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public FosteringRecordRepository(ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<FosteringRecord>> GetByDogIdAsync(Guid dogId)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<FosteringRecord>()
            .Where(x => x.DogId == dogId)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<FosteringRecord>();
        }

        return response.Models
            .OrderByDescending(x => x.StartDate)
            .ToList();
    }

    public async Task<FosteringRecord> CreateAsync(FosteringRecord record)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<FosteringRecord>()
            .Insert(record);

        return response.Models.First();
    }

    public async Task CompleteAsync(Guid id, string? feedback)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<FosteringRecord>()
            .Where(x => x.Id == id)
            .Set(x => x.Status, FosteringRecordStatuses.Completed)
            .Set(x => x.EndDate!, DateTime.UtcNow)
            .Set(x => x.Feedback!, feedback)
            .Update();
    }
}