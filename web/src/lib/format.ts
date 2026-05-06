export function inrPaiseToRupeesShort(paise: number | string): string {
  const rupees = Number(paise) / 100;
  if (Number.isNaN(rupees)) return '—';
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)} L`;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function inrPaiseToRupees(paise: number | string): string {
  const rupees = Math.round(Number(paise) / 100);
  if (Number.isNaN(rupees)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function formatDate(s: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(
      'en-IN',
      opts ?? { day: '2-digit', month: 'short', year: 'numeric' }
    );
  } catch {
    return String(s);
  }
}
