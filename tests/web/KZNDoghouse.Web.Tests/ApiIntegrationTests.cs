using System.Net;
using System.Net.Http.Json;
using KZNDoghouse.Web.DTOs;
using Microsoft.AspNetCore.Mvc.Testing;

namespace KZNDoghouse.Web.Tests;

public class ApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Me_WithoutBearerToken_ReturnsUnauthorized_NotNotFound()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });

        var response = await client.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/Home/Privacy")]
    [InlineData("/Home/AccountDeletion")]
    [InlineData("/contact?topic=account-deletion")]
    public async Task PublicAccountPrivacyPages_AreAccessibleWithoutLogin(string path)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });

        var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("/Auth/Login", 1)]
    [InlineData("/Auth/Register", 2)]
    public async Task AuthPages_ExposeAccessiblePasswordVisibilityControls(string path, int count)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });

        var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var html = await response.Content.ReadAsStringAsync();
        Assert.Equal(count, html.Split("data-password-toggle").Length - 1);
        Assert.Contains("aria-label=\"Show password\"", html);
    }

    [Fact]
    public async Task Health_ReturnsHealthyApiEnvelope_AndSecurityHeaders()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });

        var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.Contains("X-Content-Type-Options"));
        Assert.True(response.Headers.Contains("X-Frame-Options"));
        Assert.True(response.Headers.Contains("Permissions-Policy"));
        Assert.True(response.Headers.Contains("X-Permitted-Cross-Domain-Policies"));

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();

        Assert.NotNull(body);
        Assert.True(body.Success);
        Assert.Equal("API is available.", body.Message);
        Assert.NotNull(body.Data);
    }
}
