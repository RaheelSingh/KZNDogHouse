using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IDogRepository
{
    Task<IReadOnlyList<Dog>> GetAllAsync();

    Task<Dog?> GetByIdAsync(Guid dogId);

    Task<Dog> CreateAsync(Dog dog);

    Task UpdateAsync(Dog dog);

    Task UpdateStatusAsync(Guid dogId, string status);

    Task<IReadOnlyList<Dog>> GetByStatusAsync(string status);
}

public class DogRepository : IDogRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public DogRepository(ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<Dog>> GetAllAsync()
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<Dog>()
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<Dog>();
        }

        return response.Models
            .OrderBy(x => x.Name)
            .ToList();
    }

    public async Task<IReadOnlyList<Dog>> GetByStatusAsync(string status)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<Dog>()
            .Where(x => x.Status == status)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<Dog>();
        }

        return response.Models
            .OrderBy(x => x.Name)
            .ToList();
    }

    public async Task<Dog?> GetByIdAsync(Guid dogId)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<Dog>()
            .Where(x => x.Id == dogId)
            .Get();

        return response.Models?.FirstOrDefault();
    }

    public async Task<Dog> CreateAsync(Dog dog)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<Dog>()
            .Insert(dog);

        return response.Models.First();
    }

    public async Task UpdateAsync(Dog dog)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<Dog>()
            .Where(x => x.Id == dog.Id)
            .Update(dog);
    }

    public async Task UpdateStatusAsync(Guid dogId, string status)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<Dog>()
            .Where(x => x.Id == dogId)
            .Set(x => x.Status, status)
            .Set(x => x.UpdatedAt!, DateTime.UtcNow)
            .Update();
    }
}