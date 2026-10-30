using KZNDoghouse.Web.Models;

namespace KZNDoghouse.Web.Services;

public interface IDogVideoService
{
    Task<IReadOnlyList<DogVideo>> GetForDogAsync(Guid dogId);
    Task<DocumentUploadResult> UploadAsync(Guid dogId, IFormFile? video);
}

public class DogVideoService : IDogVideoService
{
    private const string Bucket = "dog-videos";
    private const long MaxBytes = 25L * 1024 * 1024;
    private readonly ISupabaseClientFactory _clients;
    private readonly ILogger<DogVideoService> _logger;

    public DogVideoService(ISupabaseClientFactory clients, ILogger<DogVideoService> logger)
    {
        _clients = clients;
        _logger = logger;
    }

    public async Task<IReadOnlyList<DogVideo>> GetForDogAsync(Guid dogId)
    {
        var client = await _clients.CreateServiceClientAsync();
        var response = await client.From<DogVideo>().Where(x => x.DogId == dogId).Get();
        return (response.Models ?? []).OrderBy(x => x.CreatedAt).ToList();
    }

    public async Task<DocumentUploadResult> UploadAsync(Guid dogId, IFormFile? video)
    {
        if (video == null || video.Length == 0) return new(false, "Choose a video to upload.");
        if (video.Length > MaxBytes) return new(false, "Video must be 25 MB or smaller.");
        try
        {
            var client = await _clients.CreateServiceClientAsync();
            var previous = await client.From<DogVideo>().Where(x => x.DogId == dogId).Get();
            if ((previous.Models?.Count ?? 0) >= 3) return new(false, "A dog can have up to three videos.");
            await using var stream = new MemoryStream();
            await video.CopyToAsync(stream);
            var bytes = stream.ToArray();
            var mp4 = bytes.Length >= 12 && bytes[4] == 'f' && bytes[5] == 't' && bytes[6] == 'y' && bytes[7] == 'p';
            var webm = bytes.Length >= 12 && bytes[0] == 0x1a && bytes[1] == 0x45 && bytes[2] == 0xdf && bytes[3] == 0xa3
                && System.Text.Encoding.ASCII.GetString(bytes.AsSpan(0, Math.Min(256, bytes.Length))).Contains("webm", StringComparison.OrdinalIgnoreCase);
            if (!mp4 && !webm) return new(false, "Only MP4 or WebM videos are supported.");
            var contentType = mp4 ? "video/mp4" : "video/webm";
            var extension = mp4 ? ".mp4" : ".webm";
            var path = $"dogs/{dogId:N}/{Guid.NewGuid():N}{extension}";
            await client.Storage.From(Bucket).Upload(bytes, path,
                new Supabase.Storage.FileOptions { ContentType = contentType, CacheControl = "3600", Upsert = false });
            try
            {
                var publicUrl = client.Storage.From(Bucket).GetPublicUrl(path);
                await client.From<DogVideo>().Insert(new DogVideo
                {
                    Id = Guid.NewGuid(), DogId = dogId, StoragePath = path,
                    PublicUrl = publicUrl, ContentType = contentType, CreatedAt = DateTime.UtcNow
                });
                return new(true, "Video uploaded. It will appear on this dog's detail page.");
            }
            catch
            {
                await client.Storage.From(Bucket).Remove(new List<string> { path });
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dog video upload failed for {DogId}", dogId);
            return new(false, "Could not upload the video. Please check the file and try again.");
        }
    }
}
