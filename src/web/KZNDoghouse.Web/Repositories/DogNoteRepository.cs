using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IDogNoteRepository
{
    Task<IReadOnlyList<DogNote>> GetByDogIdAsync(Guid dogId);

    Task<DogNote> CreateAsync(DogNote note);
}

public class DogNoteRepository : IDogNoteRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public DogNoteRepository(ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<DogNote>> GetByDogIdAsync(Guid dogId)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<DogNote>()
            .Where(x => x.DogId == dogId)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<DogNote>();
        }

        return response.Models
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
    }

    public async Task<DogNote> CreateAsync(DogNote note)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<DogNote>()
            .Insert(note);

        return response.Models.First();
    }
}