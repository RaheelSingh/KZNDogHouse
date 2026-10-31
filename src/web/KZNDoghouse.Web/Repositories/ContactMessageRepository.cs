using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IContactMessageRepository
{
    Task<ContactMessage> CreateAsync(ContactMessage message);
    Task<IReadOnlyList<ContactMessage>> GetAllAsync();
    Task UpdateStatusAsync(Guid id, string status);
}

public class ContactMessageRepository : IContactMessageRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public ContactMessageRepository(ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<ContactMessage> CreateAsync(ContactMessage message)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<ContactMessage>()
            .Insert(message);

        return response.Models.First();
    }
    public async Task<IReadOnlyList<ContactMessage>> GetAllAsync()
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();
        var response = await client.From<ContactMessage>().Get();
        return (response.Models ?? []).OrderByDescending(x => x.CreatedAt).ToList();
    }

    public async Task UpdateStatusAsync(Guid id, string status)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();
        await client.From<ContactMessage>()
            .Where(x => x.Id == id)
            .Set(x => x.Status, status)
            .Set(x => x.IsHandled, status == "Resolved")
            .Update();
    }
}
