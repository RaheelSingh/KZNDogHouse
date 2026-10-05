using KZNDoghouse.Web.Constants;

namespace KZNDoghouse.Web.Services;

public interface IMediaStorageService
{
    Task<MediaUploadResult> UploadPublicImageAsync(
        IFormFile file,
        string folder,
        Guid entityId);

    Task DeletePublicImageAsync(string? storagePath);
}

public record MediaUploadResult(
    bool Success,
    string Message,
    string? StoragePath = null,
    string? PublicUrl = null);

public class MediaStorageService : IMediaStorageService
{
    private const long MaxImageBytes = 5 * 1024 * 1024;

    private readonly ISupabaseClientFactory _supabaseClientFactory;
    private readonly ILogger<MediaStorageService> _logger;

    public MediaStorageService(
        ISupabaseClientFactory supabaseClientFactory,
        ILogger<MediaStorageService> logger)
    {
        _supabaseClientFactory = supabaseClientFactory;
        _logger = logger;
    }

    public async Task<MediaUploadResult> UploadPublicImageAsync(
        IFormFile file,
        string folder,
        Guid entityId)
    {
        if (file == null || file.Length == 0)
        {
            return new MediaUploadResult(
                false,
                "Choose an image to upload.");
        }

        if (file.Length > MaxImageBytes)
        {
            return new MediaUploadResult(
                false,
                "Images must be 5 MB or smaller.");
        }

        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream);

        var bytes = stream.ToArray();
        var detectedType = DetectImageType(bytes);

        if (detectedType == null)
        {
            return new MediaUploadResult(
                false,
                "Only JPG, PNG and WebP images are supported.");
        }

        var (contentType, extension) = detectedType.Value;

        var storagePath =
            $"{folder}/{entityId:N}/{Guid.NewGuid():N}{extension}";

        try
        {
            var client =
                await _supabaseClientFactory.CreateServiceClientAsync();

            await client.Storage
                .From(StorageBuckets.PublicMedia)
                .Upload(
                    bytes,
                    storagePath,
                    new Supabase.Storage.FileOptions
                    {
                        CacheControl = "3600",
                        ContentType = contentType,
                        Upsert = false
                    });

            var publicUrl = client.Storage
                .From(StorageBuckets.PublicMedia)
                .GetPublicUrl(storagePath);

            return new MediaUploadResult(
                true,
                "Image uploaded.",
                storagePath,
                publicUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Image upload failed for {Folder}/{EntityId}.",
                folder,
                entityId);

            return new MediaUploadResult(
                false,
                "The image could not be uploaded right now.");
        }
    }

    public async Task DeletePublicImageAsync(
        string? storagePath)
    {
        if (string.IsNullOrWhiteSpace(storagePath))
        {
            return;
        }

        try
        {
            var client =
                await _supabaseClientFactory.CreateServiceClientAsync();

            await client.Storage
                .From(StorageBuckets.PublicMedia)
                .Remove(new List<string> { storagePath });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Storage object {StoragePath} could not be deleted.",
                storagePath);
        }
    }

    private static (string ContentType, string Extension)? DetectImageType(
        byte[] bytes)
    {
        if (bytes.Length >= 3
            && bytes[0] == 0xFF
            && bytes[1] == 0xD8
            && bytes[2] == 0xFF)
        {
            return ("image/jpeg", ".jpg");
        }

        byte[] pngSignature =
        [
            0x89, 0x50, 0x4E, 0x47,
            0x0D, 0x0A, 0x1A, 0x0A
        ];

        if (bytes.Length >= pngSignature.Length
            && bytes.Take(pngSignature.Length)
                .SequenceEqual(pngSignature))
        {
            return ("image/png", ".png");
        }

        if (bytes.Length >= 12
            && bytes[0] == (byte)'R'
            && bytes[1] == (byte)'I'
            && bytes[2] == (byte)'F'
            && bytes[3] == (byte)'F'
            && bytes[8] == (byte)'W'
            && bytes[9] == (byte)'E'
            && bytes[10] == (byte)'B'
            && bytes[11] == (byte)'P')
        {
            return ("image/webp", ".webp");
        }

        return null;
    }
}
