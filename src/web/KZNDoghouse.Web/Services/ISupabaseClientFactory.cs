namespace KZNDoghouse.Web.Services;

public interface ISupabaseClientFactory
{
    Task<Supabase.Client> CreateAnonClientAsync();

    Task<Supabase.Client> CreateServiceClientAsync();
}