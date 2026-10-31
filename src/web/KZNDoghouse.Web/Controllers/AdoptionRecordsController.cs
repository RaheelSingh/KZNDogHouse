using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public sealed class AdoptionRecordsController : Controller
{
    private readonly IAdoptionRecordRepository _adoptions;
    private readonly IDogService _dogs;
    private readonly IDogDocumentService _documents;
    private readonly IUserProfileRepository _profiles;
    public AdoptionRecordsController(IAdoptionRecordRepository adoptions, IDogService dogs,
        IDogDocumentService documents, IUserProfileRepository profiles)
    {
        _adoptions = adoptions; _dogs = dogs; _documents = documents; _profiles = profiles;
    }

    private Task<IActionResult> Back(Guid dogId, string message, bool success = false)
    {
        TempData[success ? "SuccessMessage" : "ErrorMessage"] = message;
        return Task.FromResult<IActionResult>(RedirectToAction("Details", "Dogs", new { id = dogId, tab = "adoption" }));
    }

    [HttpPost, ValidateAntiForgeryToken]
    [RequestSizeLimit(55L * 1024 * 1024)]
    public async Task<IActionResult> Create(Guid dogId, string adopterName, string adopterPhone,
        string adopterAddress, string? adopterEmail, string? notes, List<IFormFile>? agreements)
    {
        var dog = await _dogs.GetDogAsync(dogId);
        if (dog == null) return NotFound();
        if (dog.Status is DogStatuses.Fostered or DogStatuses.Adopted)
            return await Back(dogId, "A fostered or adopted dog cannot start a new adoption.");
        if (string.IsNullOrWhiteSpace(adopterName) || adopterName.Length > 160
            || string.IsNullOrWhiteSpace(adopterPhone) || adopterPhone.Length > 30
            || string.IsNullOrWhiteSpace(adopterAddress) || adopterAddress.Length > 400
            || (notes?.Length ?? 0) > 2000)
            return await Back(dogId, "Enter a valid adopter name, phone number, and address.");
        if (string.IsNullOrWhiteSpace(adopterEmail) || adopterEmail.Length > 180
            || !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(adopterEmail.Trim()))
            return await Back(dogId, "A valid adopter email address is required.");
        if (agreements is { Count: > 5 } || (agreements?.Any(f => f.Length == 0 || f.Length > 10 * 1024 * 1024) ?? false))
            return await Back(dogId, "Upload at most five non-empty documents of 10 MB or less each.");
        if ((await _adoptions.GetForDogAsync(dogId)).Any(x => x.Status is "Pending paperwork" or "Adopted"))
            return await Back(dogId, "This dog already has an open adoption record.");
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var profile = string.IsNullOrEmpty(authId) ? null : await _profiles.GetByAuthUserIdAsync(authId);
        if (profile == null) return Challenge();
        var record = new AdoptionRecord
        {
            Id = Guid.NewGuid(), DogId = dogId, AdopterName = adopterName.Trim(),
            AdopterPhone = adopterPhone.Trim(), AdopterEmail = adopterEmail.Trim(),
            AdopterAddress = adopterAddress.Trim(), Notes = notes?.Trim(),
            CreatedBy = profile.Id, CreatedAt = DateTime.UtcNow, Status = "Pending paperwork"
        };
        await _adoptions.CreateAsync(record);
        // The record is created pending first, so a failed upload never incorrectly marks a dog Adopted.
        // Staff only submit documents that have already been signed and checked by the shelter.
        var requestedFiles = agreements?.Where(f => f.Length > 0).ToList() ?? [];
        var failedUploads = new List<string>();
        foreach (var agreement in requestedFiles)
        {
            try
            {
                var result = await _documents.UploadAsync(dogId, null, "Adoption", agreement, profile.Id,
                    adoptionRecordId: record.Id);
                if (!result.Success) failedUploads.Add(result.Message);
            }
            catch (Exception)
            {
                failedUploads.Add("Secure document upload failed unexpectedly. Check the Render application logs.");
            }
        }
        if (failedUploads.Count > 0)
            return await Back(dogId,
                $"Adoption saved as Pending paperwork. {failedUploads.Count} document(s) failed: {string.Join(" ", failedUploads.Distinct())} Retry from this record; do not create a duplicate.");

        // No initial paperwork: remain Pending. A successfully saved initial agreement:
        // transition both the adoption record and the dog to Adopted.
        if (requestedFiles.Count == 0)
            return await Back(dogId, "Adoption record created as Pending paperwork. Upload the signed agreement to continue.", true);
        try
        {
            await _adoptions.SetAdoptedAsync(record.Id);
            await _dogs.ChangeStatusAsync(dogId, DogStatuses.Adopted);
        }
        catch (Exception)
        {
            return await Back(dogId, "Document uploaded but adoption status could not be completed. Review the record and dog status before retrying; do not create another record.");
        }
        return await Back(dogId, "Signed paperwork saved. Adoption confirmed and dog marked Adopted.", true);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> UploadAgreement(Guid dogId, Guid recordId, IFormFile? file)
    {
        var record = await _adoptions.GetAsync(recordId);
        if (record == null || record.DogId != dogId) return NotFound();
        // Keep records complete through adoption and after a return; never expose these documents publicly.
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var profile = string.IsNullOrEmpty(authId) ? null : await _profiles.GetByAuthUserIdAsync(authId);
        if (profile == null) return Challenge();
        var result = await _documents.UploadAsync(dogId, null, "Adoption", file, profile.Id,
            adoptionRecordId: recordId);
        // JavaScript-enhanced uploads update the open adoption record without leaving the tab.
        // The ordinary form redirect remains available when JavaScript is disabled.
        if (Request.Headers.Accept.Any(value => value?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true))
        {
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Message });

            var documents = (await _documents.GetForDogAsync(dogId))
                .Where(d => d.AdoptionRecordId == recordId && d.Category == "Adoption")
                .Select(d => new
                {
                    name = d.FileName,
                    url = Url.Action("Download", "DogDocuments", new { id = d.Id })
                }).ToList();
            return Json(new { success = true, message = result.Message, documents });
        }
        return await Back(dogId, result.Message, result.Success);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Confirm(Guid dogId, Guid recordId)
    {
        var record = await _adoptions.GetAsync(recordId);
        var dog = await _dogs.GetDogAsync(dogId);
        if (record == null || dog == null || record.DogId != dogId) return NotFound();
        if (record.Status != "Pending paperwork" || dog.Status is DogStatuses.Adopted or DogStatuses.Fostered)
            return await Back(dogId, "This adoption is not eligible for confirmation.");
        if (!(await _documents.GetForDogAsync(dogId)).Any(d => d.AdoptionRecordId == recordId && d.Category == "Adoption"))
            return await Back(dogId, "Upload the signed adoption agreement before confirming.");
        await _adoptions.SetAdoptedAsync(recordId);
        await _dogs.ChangeStatusAsync(dogId, DogStatuses.Adopted);
        return await Back(dogId, "Adoption confirmed.", true);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Cancel(Guid dogId, Guid recordId, string? reason)
    {
        var record = await _adoptions.GetAsync(recordId);
        var dog = await _dogs.GetDogAsync(dogId);
        if (record == null || dog == null || record.DogId != dogId) return NotFound();
        if (record.Status != "Pending paperwork" || dog.Status is DogStatuses.Adopted or DogStatuses.Fostered)
            return await Back(dogId, "Only a pending adoption can be cancelled.");
        if ((reason?.Length ?? 0) > 2000)
            return await Back(dogId, "Cancellation reason is too long.");
        await _adoptions.SetCancelledAsync(recordId, reason?.Trim());
        return await Back(dogId, "Pending adoption cancelled. The record remains in history.", true);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Return(Guid dogId, Guid recordId, string? returnNotes)
    {
        var record = await _adoptions.GetAsync(recordId);
        var dog = await _dogs.GetDogAsync(dogId);
        if (record == null || dog == null || record.DogId != dogId) return NotFound();
        if (record.Status != "Adopted" || dog.Status != DogStatuses.Adopted)
            return await Back(dogId, "Only an active adoption can be returned.");
        if ((returnNotes?.Length ?? 0) > 2000) return await Back(dogId, "Return notes are too long.");
        await _adoptions.SetReturnedAsync(recordId, returnNotes?.Trim());
        await _dogs.ChangeStatusAsync(dogId, DogStatuses.Available);
        return await Back(dogId, "Dog returned from adoption and marked available.", true);
    }
}
