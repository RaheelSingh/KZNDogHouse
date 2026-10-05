using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("inventory_transactions")]
public class InventoryTransaction : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("item_id")]
    public Guid ItemId { get; set; }

    [Column("transaction_type")]
    public string TransactionType { get; set; } = InventoryTransactionTypes.Delivery;

    [Column("quantity_change")]
    public int QuantityChange { get; set; }

    [Column("transaction_date")]
    public DateTime TransactionDate { get; set; }

    [Column("expiry_date")]
    public DateTime? ExpiryDate { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("updated_by_user_id")]
    public Guid UpdatedByUserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}