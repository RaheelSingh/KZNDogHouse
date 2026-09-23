using KZNDoghouse.Web.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[ApiController]
[Route("api")]
public class ApiController : ControllerBase
{
    [HttpGet("health")]
    public ActionResult<ApiResponse<object>> Health()
    {
        var data = new
        {
            Status = "Healthy",
            Application = "KZN Doghouse API",
            Timestamp = DateTime.UtcNow
        };

        return Ok(
            ApiResponse<object>.Ok(
                data,
                "API is available."));
    }
}