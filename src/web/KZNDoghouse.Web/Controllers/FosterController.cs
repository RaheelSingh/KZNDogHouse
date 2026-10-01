using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Route("foster")]
public class FosterController : Controller
{
    [HttpGet("")]
    public IActionResult Index()
    {
        return View();
    }
}
