using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Route("our-dogs")]
public class PublicDogsController : Controller
{
    private readonly IDogService _dogService;
    private readonly ILogger<PublicDogsController> _logger;

    public PublicDogsController(
        IDogService dogService,
        ILogger<PublicDogsController> logger)
    {
        _dogService = dogService;
        _logger = logger;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        try
        {
            var dogs = await _dogService.GetPublicDogsAsync();

            return View(dogs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Public dogs could not be loaded.");

            ViewData["LoadFailed"] = true;

            return View(Array.Empty<PublicDogListItem>());
        }
    }
}
