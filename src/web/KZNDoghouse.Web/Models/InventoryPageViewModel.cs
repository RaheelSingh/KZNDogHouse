namespace KZNDoghouse.Web.Models;

public class InventoryPageViewModel
{
    public IReadOnlyList<InventoryItemSummary> Items { get; set; } =
        Array.Empty<InventoryItemSummary>();

    public int LowStockCount => Items.Count(x => x.Item.IsLowStock());

    public int ExpiringSoonCount => Items.Count(x => x.IsExpiringSoon);

    public int ExpiredCount => Items.Count(x => x.IsExpired);
}

public class InventoryItemSummary
{
    public InventoryItem Item { get; set; } = null!;

    public IReadOnlyList<InventoryTransaction> RecentTransactions { get; set; } =
        Array.Empty<InventoryTransaction>();

    public DateTime? NextExpiryDate { get; set; }

    public InventoryTransaction? LatestTransaction =>
        RecentTransactions
            .OrderByDescending(x => x.TransactionDate)
            .FirstOrDefault();

    public bool IsExpired =>
        NextExpiryDate.HasValue
        && NextExpiryDate.Value.Date < DateTime.UtcNow.Date;

    public bool IsExpiringSoon =>
        NextExpiryDate.HasValue
        && NextExpiryDate.Value.Date >= DateTime.UtcNow.Date
        && NextExpiryDate.Value.Date <= DateTime.UtcNow.Date.AddDays(30);

    public string ExpiryState =>
        IsExpired
            ? "Expired"
            : IsExpiringSoon
                ? "Expiring Soon"
                : NextExpiryDate.HasValue
                    ? "Dated"
                    : "No Expiry";
}
