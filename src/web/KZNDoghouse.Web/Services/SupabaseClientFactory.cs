using KZNDoghouse.Web.Configuration;
using Microsoft.Extensions.Options;

namespace KZNDoghouse.Web.Services;

public class SupabaseClientFactory : ISupabaseClientFactory
{
    private readonly SupabaseSettings _settings;

    public SupabaseClientFactory(IOptions<SupabaseSettings> options)
    {
        _settings = options.Value;
    }

    public async Task<Supabase.Client> CreateAnonClientAsync()
    {
        ValidateSettings(_settings.AnonKey, "anon");

        var client = CreateClient(_settings.AnonKey);

        await client.InitializeAsync();

        return client;
    }

    public async Task<Supabase.Client> CreateServiceClientAsync()
    {
        ValidateSettings(_settings.ServiceRoleKey, "service role");

        var client = CreateClient(_settings.ServiceRoleKey);

        await client.InitializeAsync();

        return client;
    }

    private Supabase.Client CreateClient(string key)
    {
        var options = new Supabase.SupabaseOptions
        {
            AutoRefreshToken = false,
            AutoConnectRealtime = false
        };

        return new Supabase.Client(
            _settings.Url,
            key,
            options);
    }

    private void ValidateSettings(string key, string keyName)
    {
        if (string.IsNullOrWhiteSpace(_settings.Url))
        {
            throw new InvalidOperationException(
                "Supabase URL has not been configured.");
        }

        if (!Uri.TryCreate(
                _settings.Url,
                UriKind.Absolute,
                out _))
        {
            throw new InvalidOperationException(
                "The configured Supabase URL is invalid.");
        }

        if (string.IsNullOrWhiteSpace(key))
        {
            throw new InvalidOperationException(
                $"The Supabase {keyName} key has not been configured.");
        }
    }
}