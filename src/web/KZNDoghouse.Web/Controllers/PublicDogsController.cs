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
    public async Task<IActionResult> Index(string? search, string? gender, string? size)
    {
        var filter = PublicDogFilter.Create(search, gender, size);

        try
        {
            var dogs = await _dogService.GetPublicDogsAsync();

            var model = new PublicDogListViewModel
            {
                Dogs = filter.Apply(dogs),
                TotalCount = dogs.Count,
                Filter = filter,
                SizeOptions = dogs
                    .Select(x => x.Size)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(x => x)
                    .ToList()
            };

            return View(model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Public dogs could not be loaded.");

            ViewData["LoadFailed"] = true;

            return View(new PublicDogListViewModel { Filter = filter });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Details(Guid id)
    {
        try
        {
            var dog = await _dogService.GetPublicDogAsync(id);

            if (dog == null)
            {
                Response.StatusCode = StatusCodes.Status404NotFound;

                return View("Unavailable", new PublicMessageViewModel
                {
                    Title = "This dog is not available",
                    Message = "They may have found a home, or the link may be incorrect."
                });
            }

            return View(dog);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Public dog {DogId} could not be loaded.", id);

            Response.StatusCode = StatusCodes.Status503ServiceUnavailable;

            return View("Unavailable", new PublicMessageViewModel
            {
                Title = "We could not load this dog",
                Message = "Please try again in a few minutes."
            });
        }
    }
}
