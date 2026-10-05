using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Route("contact")]
public class ContactController : Controller
{
    private const int PrefilledMessageLimit = 500;

    private readonly IContactMessageService _contactMessageService;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly ILogger<ContactController> _logger;

    public ContactController(
        IContactMessageService contactMessageService,
        IUserProfileRepository userProfileRepository,
        ILogger<ContactController> logger)
    {
        _contactMessageService = contactMessageService;
        _userProfileRepository = userProfileRepository;
        _logger = logger;
    }

    [HttpGet("")]
    public IActionResult Index(string? topic, string? message)
    {
        ModelState.Clear();

        var model = new ContactFormViewModel
        {
            Topic = ContactTopics.FromKey(topic) ?? string.Empty,
            Message = Prefill(message)
        };

        if (User.Identity?.IsAuthenticated == true)
        {
            var nameParts = (User.Identity.Name ?? string.Empty)
                .Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);

            model.FirstName = nameParts.Length > 0 ? nameParts[0] : string.Empty;
            model.LastName = nameParts.Length > 1 ? nameParts[1] : string.Empty;
            model.Email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        }

        return View(model);
    }

    [HttpPost("")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Index(ContactFormViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        try
        {
            var profileId = await GetCurrentProfileIdAsync();

            await _contactMessageService.SubmitAsync(model, profileId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "A contact message could not be saved.");

            ModelState.AddModelError(
                string.Empty,
                $"We could not send your message right now. Please email us at {PublicSiteInfo.Email} instead.");

            return View(model);
        }

        return RedirectToAction(nameof(Sent));
    }

    [HttpGet("sent")]
    public IActionResult Sent()
    {
        return View();
    }

    private async Task<Guid?> GetCurrentProfileIdAsync()
    {
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authId))
        {
            return null;
        }

        try
        {
            var profile = await _userProfileRepository.GetByAuthUserIdAsync(authId);

            return profile?.Id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "The sender profile could not be loaded for a contact message.");

            return null;
        }
    }

    private static string Prefill(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return string.Empty;
        }

        var trimmed = message.Trim();

        return trimmed.Length > PrefilledMessageLimit
            ? trimmed[..PrefilledMessageLimit]
            : trimmed;
    }
}
