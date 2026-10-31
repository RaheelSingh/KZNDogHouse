using System.Security.Cryptography;
using Microsoft.Extensions.Caching.Memory;

namespace KZNDoghouse.Web.Services;

public interface IPasswordResetStateService
{
    TimeSpan Cooldown { get; }

    bool TryStartCooldown(
        string email,
        out TimeSpan remaining);

    TimeSpan GetCooldownRemaining(
        string email);

    void ClearCooldown(
        string email);

    string CreateTicket(
        string email,
        string accessToken,
        string refreshToken);

    PasswordResetTicket? GetTicket(
        string? ticketId);

    void RemoveTicket(
        string? ticketId);
}

public record PasswordResetTicket(
    string Email,
    string AccessToken,
    string RefreshToken);

public class PasswordResetStateService : IPasswordResetStateService
{
    private static readonly TimeSpan CooldownPeriod =
        TimeSpan.FromMinutes(5);

    private static readonly TimeSpan TicketLifetime =
        TimeSpan.FromMinutes(10);

    private readonly IMemoryCache _cache;
    private readonly object _cooldownLock = new();

    public PasswordResetStateService(
        IMemoryCache cache)
    {
        _cache = cache;
    }

    public TimeSpan Cooldown => CooldownPeriod;

    public bool TryStartCooldown(
        string email,
        out TimeSpan remaining)
    {
        var key = CooldownKey(email);
        var now = DateTimeOffset.UtcNow;

        // The lock makes "check, then start the timer" happen as one step,
        // so a double click can never send two emails.
        lock (_cooldownLock)
        {
            if (_cache.TryGetValue(key, out DateTimeOffset availableAt)
                && availableAt > now)
            {
                remaining = availableAt - now;
                return false;
            }

            var nextAllowedAt = now.Add(CooldownPeriod);

            _cache.Set(
                key,
                nextAllowedAt,
                nextAllowedAt);

            remaining = CooldownPeriod;
            return true;
        }
    }

    public TimeSpan GetCooldownRemaining(
        string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return TimeSpan.Zero;
        }

        if (_cache.TryGetValue(CooldownKey(email), out DateTimeOffset availableAt))
        {
            var remaining = availableAt - DateTimeOffset.UtcNow;

            return remaining > TimeSpan.Zero
                ? remaining
                : TimeSpan.Zero;
        }

        return TimeSpan.Zero;
    }

    public void ClearCooldown(
        string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        lock (_cooldownLock)
        {
            _cache.Remove(CooldownKey(email));
        }
    }

    public string CreateTicket(
        string email,
        string accessToken,
        string refreshToken)
    {
        // 32 random bytes = 64 hex characters. Impossible to guess.
        var ticketId =
            Convert.ToHexString(
                RandomNumberGenerator.GetBytes(32));

        _cache.Set(
            TicketKey(ticketId),
            new PasswordResetTicket(
                NormaliseEmail(email),
                accessToken,
                refreshToken),
            TicketLifetime);

        return ticketId;
    }

    public PasswordResetTicket? GetTicket(
        string? ticketId)
    {
        if (!IsValidTicketFormat(ticketId))
        {
            return null;
        }

        return _cache.TryGetValue(TicketKey(ticketId!), out PasswordResetTicket? ticket)
            ? ticket
            : null;
    }

    public void RemoveTicket(
        string? ticketId)
    {
        if (!IsValidTicketFormat(ticketId))
        {
            return;
        }

        _cache.Remove(TicketKey(ticketId!));
    }

    private static bool IsValidTicketFormat(
        string? ticketId)
    {
        return !string.IsNullOrWhiteSpace(ticketId)
            && ticketId.Length == 64
            && ticketId.All(Uri.IsHexDigit);
    }

    private static string NormaliseEmail(
        string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    private static string CooldownKey(
        string email)
    {
        return $"password-reset:cooldown:{NormaliseEmail(email)}";
    }

    private static string TicketKey(
        string ticketId)
    {
        return $"password-reset:ticket:{ticketId.ToUpperInvariant()}";
    }
}