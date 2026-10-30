using KZNDoghouse.Web.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public class ContactInboxController : Controller
{
    private readonly IContactMessageRepository _messages;

    public ContactInboxController(IContactMessageRepository messages) => _messages = messages;

    [HttpGet]
    public async Task<IActionResult> Index() => View(await _messages.GetAllAsync());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateStatus(Guid id, string status)
    {
        if (status is not ("New" or "Ongoing" or "Resolved"))
        {
            TempData["ErrorMessage"] = "Choose a valid contact status.";
            return RedirectToAction(nameof(Index));
        }
        await _messages.UpdateStatusAsync(id, status);
        TempData["SuccessMessage"] = "Message status updated.";
        return RedirectToAction(nameof(Index));
    }
}
