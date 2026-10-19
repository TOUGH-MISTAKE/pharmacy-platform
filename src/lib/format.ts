/** Formats a number as Kenyan shillings, e.g. "KES 1,450" or "KES 12.50". */
export function formatKes(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasDecimals = !Number.isInteger(rounded);
  const formatted = rounded.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `KES ${formatted}`;
}
