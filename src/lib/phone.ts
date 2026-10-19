/**
 * Converts common Kenyan mobile number formats into the international format
 * that M-Pesa and our database expect (2547XXXXXXXX or 2541XXXXXXXX).
 * Returns null when the number is not a valid Kenyan mobile number.
 *
 * Accepted examples: 0712345678, 0112345678, 712345678, +254712345678, 254 712 345 678
 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");

  if (/^\+?254[17]\d{8}$/.test(digits)) {
    return `254${digits.replace(/^\+?254/, "")}`;
  }
  if (/^0[17]\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }
  if (/^[17]\d{8}$/.test(digits)) {
    return `254${digits}`;
  }
  return null;
}
