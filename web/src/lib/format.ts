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

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

/**
 * Whole calendar months between two dates — 1 Feb → 1 Mar is 1 month whether or
 * not February had 28 days, which a fixed 30-day divisor gets wrong.
 */
function calendarMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1; // day-of-month not reached yet
  return Math.max(0, months);
}

/**
 * Human "time since" that scales all the way up: seconds → minutes → hours →
 * days → weeks → months → years, always using the largest unit that fits.
 */
export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const then = value instanceof Date ? value : new Date(value);
  const ms = then.getTime();
  if (Number.isNaN(ms)) return '—';

  const now = new Date();
  const seconds = Math.floor((now.getTime() - ms) / 1000);
  if (seconds < 5) return 'just now'; // also covers small clock skew into the future
  if (seconds < 60) return plural(seconds, 'second');

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return plural(minutes, 'minute');

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, 'hour');

  const days = Math.floor(hours / 24);
  if (days < 7) return plural(days, 'day');

  const months = calendarMonthsBetween(then, now);
  if (months < 1) return plural(Math.floor(days / 7), 'week');
  if (months < 12) return plural(months, 'month');
  return plural(Math.floor(months / 12), 'year');
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
