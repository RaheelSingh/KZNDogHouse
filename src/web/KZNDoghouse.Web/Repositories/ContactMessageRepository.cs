using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IContactMessageRepository
{
    Task<ContactMessage> CreateAsync(ContactMessage message);
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
}
