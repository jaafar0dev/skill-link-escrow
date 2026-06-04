export function formatNaira(amount: number | null | undefined) {
  if (amount == null) return "—";
  return `₦${amount.toLocaleString("en-NG")}`;
}
