using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Route("get-involved")]
public class GetInvolvedController : Controller
{
    [HttpGet("")]
    public IActionResult Index()
    {
        return View();
    }
}
