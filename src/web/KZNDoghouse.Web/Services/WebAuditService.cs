using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using KZNDoghouse.Web.Configuration;
using Microsoft.Extensions.Options;

namespace KZNDoghouse.Web.Services;

public interface IWebAuditService
{
    Task RecordAsync(Guid authUserId, string method, string path, int status,
        Guid? recordId = null, string label = "web_request_completed");
}

/// <summary>Attributes successful cookie-authenticated mutations to the current web user.
/// The database row-change triggers separately record which rows were changed.</summary>
public sealed class WebAuditService : IWebAuditService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<SupabaseSettings> _settings;
    private readonly ILogger<WebAuditService> _logger;

    public WebAuditService(IHttpClientFactory httpClientFactory,
        IOptions<SupabaseSettings> settings, ILogger<WebAuditService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _settings = settings;
        _logger = logger;
    }

    public async Task RecordAsync(Guid authUserId, string method, string path, int status,
        Guid? recordId = null, string label = "web_request_completed")
    {
        var settings = _settings.Value;
        if (string.IsNullOrWhiteSpace(settings.Url) || string.IsNullOrWhiteSpace(settings.ServiceRoleKey)) return;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post,
                $"{settings.Url.TrimEnd('/')}/rest/v1/rpc/kzn_record_web_action");
            request.Headers.TryAddWithoutValidation("apikey", settings.ServiceRoleKey);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ServiceRoleKey);
            request.Content = JsonContent.Create(new
            {
                p_auth_user_id = authUserId, p_method = method,
                p_request_path = path, p_http_status = status,
                p_record_id = recordId, p_action_label = label
            });
            using var http = _httpClientFactory.CreateClient("KznAudit");
            using var response = await http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("Audit write was rejected (HTTP {Status}). Check audit SQL migration.", (int)response.StatusCode);
        }
        catch (Exception ex)
        {
            // Audit failures are visible in server logs but do not make an otherwise-successful action fail.
            _logger.LogError(ex, "Could not write web audit event for {Method} {Path}", method, path);
        }
    }
}

/// <summary>Captures authenticated portal mutations; no body, cookies, tokens or passwords logged.</summary>
public sealed class WebAuditMiddleware
{
    private readonly RequestDelegate _next;
    public WebAuditMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, IWebAuditService audit)
    {
        await _next(context);
        if (context.User.Identity?.IsAuthenticated != true) return;
        if (context.Request.Method is not ("POST" or "PUT" or "PATCH" or "DELETE")) return;
        if (context.Response.StatusCode is < 200 or >= 400) return;
        var path = context.Request.Path.Value ?? "";
        if (path.StartsWith("/Auth/", StringComparison.OrdinalIgnoreCase)) return;
        // Bearer/API actions are audited by database JWT triggers where applicable.
        if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)) return;
        if (!Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var authId)) return;
        await audit.RecordAsync(authId, context.Request.Method, path, context.Response.StatusCode);
    }
}
