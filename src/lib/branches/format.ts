/** Turns 254712345678 into "+254 712 345 678". Other formats are returned unchanged. */
export function formatKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("254")) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return phone;
}

export function phoneHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("254") ? `tel:+${digits}` : `tel:${digits}`;
}
