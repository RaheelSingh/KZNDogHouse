using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace KZNDoghouse.Web.Controllers;

/// <summary>Reuses the web's existing, validated video-upload service for mobile staff.</summary>
[ApiController]
[Route("api/mobile/dogs")]
[EnableRateLimiting(RateLimitPolicies.Api)]
public sealed class MobileDogVideoController : ControllerBase
{
    private readonly IApiAuthenticationService _authentication;
    private readonly IDogVideoService _videos;
    private readonly IWebAuditService _audit;

    public MobileDogVideoController(IApiAuthenticationService authentication, IDogVideoService videos, IWebAuditService audit)
    {
        _authentication = authentication;
        _videos = videos;
        _audit = audit;
    }

    [HttpPost("{dogId:guid}/videos")]
    [RequestSizeLimit(27 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid dogId, IFormFile? video)
    {
        var profile = await _authentication.AuthenticateAsync(Request.Headers.Authorization.ToString());
        if (profile is null) return Unauthorized(new { success = false, message = "Sign in is required." });
        if (profile.Role is not ("Staff" or "Administrator"))
            return StatusCode(StatusCodes.Status403Forbidden, new { success = false, message = "Access denied." });
        if (dogId == Guid.Empty || video is null)
            return BadRequest(new { success = false, message = "A dog and video are required." });

        var result = await _videos.UploadAsync(dogId, video);
        if (result.Success)
        {
            await _audit.RecordAsync(profile.AuthUserId, "POST", "/api/mobile/dogs/videos", 200, dogId, "dog_video_uploaded");
            return Ok(new { success = true, message = result.Message });
        }
        return BadRequest(new { success = false, message = result.Message });
    }
}
