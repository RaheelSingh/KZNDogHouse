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

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();

        Assert.NotNull(body);
        Assert.True(body.Success);
        Assert.Equal("API is available.", body.Message);
        Assert.NotNull(body.Data);
    }
}
