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
        var current = (await _messages.GetAllAsync()).FirstOrDefault(x => x.Id == id);
        if (current == null) return NotFound();
        if (current.Status == "Resolved"
            && (!User.IsInRole("Administrator") || status != "Ongoing"))
        {
            TempData["ErrorMessage"] = "Only administrators can reopen resolved enquiries.";
            return RedirectToAction(nameof(Index));
        }
        if (current.Status != "Resolved" && status == "New")
        {
            TempData["ErrorMessage"] = "An enquiry cannot be moved back to New.";
            return RedirectToAction(nameof(Index));
        }
        if (current.Status == "New" && status == "Resolved")
        {
            TempData["ErrorMessage"] = "Mark the enquiry as ongoing before resolving it.";
            return RedirectToAction(nameof(Index));
        }
        if (current.Status == status) return RedirectToAction(nameof(Index));
        await _messages.UpdateStatusAsync(id, status);
        TempData["SuccessMessage"] = "Message status updated.";
        return RedirectToAction(nameof(Index));
    }
}
