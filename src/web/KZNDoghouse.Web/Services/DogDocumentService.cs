using KZNDoghouse.Web.Models;

namespace KZNDoghouse.Web.Services;

public record DocumentUploadResult(bool Success, string Message);

public interface IDogDocumentService
{
    Task<IReadOnlyList<DogDocument>> GetForDogAsync(Guid dogId);
    Task<DogDocument?> GetAsync(Guid id);
    Task<DocumentUploadResult> UploadAsync(Guid dogId, Guid? medicalRecordId, string category, IFormFile? file, Guid actorId, Guid? fosterApplicationId = null);
    Task<byte[]> DownloadAsync(DogDocument document);
}

public class DogDocumentService : IDogDocumentService
{
    private const string Bucket = "dog-private-documents";
    private const long MaxSize = 10 * 1024 * 1024;
    private readonly ISupabaseClientFactory _clients;
    private readonly ILogger<DogDocumentService> _logger;

    public DogDocumentService(ISupabaseClientFactory clients, ILogger<DogDocumentService> logger)
    {
        _clients = clients;
        _logger = logger;
    }

    public async Task<IReadOnlyList<DogDocument>> GetForDogAsync(Guid dogId)
    {
        var client = await _clients.CreateServiceClientAsync();
        var result = await client.From<DogDocument>().Where(x => x.DogId == dogId).Get();
        return (result.Models ?? []).OrderByDescending(x => x.CreatedAt).ToList();
    }

    public async Task<DogDocument?> GetAsync(Guid id)
    {
        var client = await _clients.CreateServiceClientAsync();
        var result = await client.From<DogDocument>().Where(x => x.Id == id).Get();
        return result.Models?.FirstOrDefault();
    }

    public async Task<DocumentUploadResult> UploadAsync(Guid dogId, Guid? medicalRecordId, string category, IFormFile? file, Guid actorId, Guid? fosterApplicationId = null)
    {
        if (file == null || file.Length == 0) return new(false, "Select a document to upload.");
        if (file.Length > MaxSize) return new(false, "Documents must be 10 MB or smaller.");
        if (category is not ("Medical" or "Foster" or "Adoption")) return new(false, "Choose a valid document category.");

        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer);
        var bytes = buffer.ToArray();
        // Validate the file contents, not its extension or the browser-supplied MIME type.
        var kind = DetectType(bytes);
        if (kind == null) return new(false, "Only PDF, JPG, PNG and WebP documents are permitted.");
        var (mime, extension) = kind.Value;
        var cleanName = Path.GetFileName(file.FileName);
        if (string.IsNullOrWhiteSpace(cleanName)) cleanName = $"document{extension}";
        cleanName = cleanName.Length > 180 ? cleanName[..180] : cleanName;
        var path = $"dogs/{dogId:N}/{category.ToLowerInvariant()}/{Guid.NewGuid():N}{extension}";
        var client = await _clients.CreateServiceClientAsync();
        try
        {
            await client.Storage.From(Bucket).Upload(bytes, path,
                new Supabase.Storage.FileOptions { ContentType = mime, Upsert = false, CacheControl = "60" });
            try
            {
                var row = new DogDocument
                {
                    Id = Guid.NewGuid(), DogId = dogId, MedicalRecordId = medicalRecordId,
                    Category = category, FileName = cleanName, ContentType = mime, FosterApplicationId = fosterApplicationId,
                    StoragePath = path, UploadedBy = actorId, CreatedAt = DateTime.UtcNow
                };
                await client.From<DogDocument>().Insert(row);
                return new(true, "Document uploaded securely.");
            }
            catch
            {
                await client.Storage.From(Bucket).Remove(new List<string> { path });
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Private dog document upload failed for {DogId}.", dogId);
            return new(false, "The document couldn't be saved. Please try again.");
        }
    }

    public async Task<byte[]> DownloadAsync(DogDocument document)
    {
        var client = await _clients.CreateServiceClientAsync();
        return await client.Storage.From(Bucket)
            .Download(document.StoragePath, (EventHandler<float>?)null);
    }

    private static (string Mime, string Extension)? DetectType(byte[] b)
    {
        if (b.Length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') return ("application/pdf", ".pdf");
        if (b.Length >= 3 && b[0] == 0xff && b[1] == 0xd8 && b[2] == 0xff) return ("image/jpeg", ".jpg");
        if (b.Length >= 8 && b.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return ("image/png", ".png");
        if (b.Length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return ("image/webp", ".webp");
        return null;
    }
}
