namespace KZNDoghouse.Web.Constants;

public static class InventoryTransactionTypes
{
    public const string Delivery = "Delivery";
    public const string Usage = "Usage";
    public const string Adjustment = "Adjustment";

    // Historical adjustments stay readable, but new transactions are only received or used.
    public static readonly string[] All = [Delivery, Usage];
}