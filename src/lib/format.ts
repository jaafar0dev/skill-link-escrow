export function formatNaira(amount: number | null | undefined) {
  if (amount == null) return "—";
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function formatUSD(amount: number | null | undefined) {
  if (amount == null) return "—";
  return `$${amount.toLocaleString("en-US")}`;
}

export function formatStatus(status: string | null | undefined) {
  if (!status) return "—";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
